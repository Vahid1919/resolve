import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import { db, initDb } from './db.js'
import tasksRouter from './routes/tasks.js'
import habitsRouter from './routes/habits.js'
import areasRouter from './routes/areas.js'

// ── Init DB ───────────────────────────────────────────────────────────────────
initDb()

const app = express()

// Trust Railway's reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1)

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

app.use(express.json())
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
}))
app.use(passport.initialize())
app.use(passport.session())

// ── Google OAuth strategy ─────────────────────────────────────────────────────
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('\n⚠  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — auth will not work.\n   Copy .env.example to .env and fill in your credentials.\n')
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
}, (_access, _refresh, profile, done) => {
    try {
        db.prepare(`
      INSERT INTO users (id, email, name, avatar)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar
    `).run(profile.id, profile.emails[0].value, profile.displayName, profile.photos?.[0]?.value ?? null)
        const user = db.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').get(profile.id)
        done(null, user)
    } catch (err) {
        done(err)
    }
}))

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser((id, done) => {
    try {
        const user = db.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').get(id)
        done(null, user ?? false)
    } catch (err) {
        done(err)
    }
})

// ── Auth routes ───────────────────────────────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${CLIENT_ORIGIN}?auth=error` }),
    (req, res) => {
        // Issue a JWT and send it to the frontend via URL param.
        // This avoids cross-domain session cookie issues (Firefox, Safari).
        const token = jwt.sign(
            { id: req.user.id, email: req.user.email, name: req.user.name, avatar: req.user.avatar },
            process.env.SESSION_SECRET,
            { expiresIn: '30d' }
        )
        res.redirect(`${CLIENT_ORIGIN}?token=${token}`)
    }
)

// Logout is client-side (clear localStorage token); this endpoint is a no-op
app.post('/auth/logout', (_req, res) => res.json({ ok: true }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ ok: true, service: 'resolve-api' }))

// ── requireAuth middleware (JWT-based, works cross-domain in all browsers) ────
function requireAuth(req, res, next) {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthenticated' })
    try {
        req.user = jwt.verify(auth.slice(7), process.env.SESSION_SECRET)
        next()
    } catch {
        return res.status(401).json({ error: 'unauthenticated' })
    }
}

// ── /api/me ───────────────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => res.json(req.user))

// ── /api/sync — return all user data in the shape the frontend stores expect ──
app.get('/api/sync', requireAuth, (req, res) => {
    const uid = req.user.id

    // Areas
    const areas = db.prepare(
        'SELECT id, name, color FROM areas WHERE user_id = ? ORDER BY created_at'
    ).all(uid)

    // Tasks → tasksByDate / completedByDate
    const taskRows = db.prepare(
        'SELECT id, date_key, text, area_id, done FROM tasks WHERE user_id = ? ORDER BY created_at'
    ).all(uid)
    const tasksByDate = {}
    const completedByDate = {}
    for (const t of taskRows) {
        const task = { id: t.id, text: t.text, areaId: t.area_id }
        if (t.done) {
            ; (completedByDate[t.date_key] ??= []).push(task)
        } else {
            ; (tasksByDate[t.date_key] ??= []).push(task)
        }
    }

    // Habit defs
    const habitRows = db.prepare(
        'SELECT id, text, cadence, custom_days, start_date, end_date, area_id FROM habit_defs WHERE user_id = ? ORDER BY id'
    ).all(uid)
    const habitDefs = habitRows.map(h => ({
        id: h.id,
        text: h.text,
        cadence: h.cadence,
        customDays: JSON.parse(h.custom_days || '[]'),
        startDate: h.start_date,
        endDate: h.end_date ?? undefined,
        areaId: h.area_id,
    }))

    // Habit completions → { [dateKey]: id[] }
    const habitCompletions = {}
    for (const c of db.prepare('SELECT date_key, habit_id FROM habit_completions WHERE user_id = ?').all(uid)) {
        ; (habitCompletions[c.date_key] ??= []).push(c.habit_id)
    }

    // Habit exceptions → { [dateKey]: id[] }
    const habitExceptions = {}
    for (const e of db.prepare('SELECT date_key, habit_id FROM habit_exceptions WHERE user_id = ?').all(uid)) {
        ; (habitExceptions[e.date_key] ??= []).push(e.habit_id)
    }

    res.json({ areas, tasksByDate, completedByDate, habitDefs, habitCompletions, habitExceptions })
})

// ── API routers (all require auth via middleware) ─────────────────────────────
app.use('/api/tasks', requireAuth, tasksRouter)
app.use('/api/habits', requireAuth, habitsRouter)
app.use('/api/areas', requireAuth, areasRouter)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`\n  Server →  http://localhost:${PORT}`)
    console.log(`  Auth   →  http://localhost:${PORT}/auth/google\n`)
})
