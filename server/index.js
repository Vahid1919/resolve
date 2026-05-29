/**
 * index.js — the backend server (the API and the auth flow).
 *
 * What it does, top to bottom:
 *   1. Open/prepare the SQLite database.
 *   2. Set up Express with JSON parsing, CORS, sessions, and Passport.
 *   3. Configure "Sign in with Google" (Passport's Google strategy).
 *   4. Define the auth routes (/auth/google, the callback, logout).
 *   5. Define the data API: /api/me, /api/sync, and the task/habit/area routers.
 *   6. In production, also serve the built frontend so one server hosts both.
 *
 * Auth in one sentence: Google verifies the user, then we hand the browser a
 * signed JWT, and the browser sends that JWT back on every API request so we
 * know who's asking. (See requireAuth below and src/auth.js on the frontend.)
 */

import 'dotenv/config'                  // load variables from the .env file
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import { db, initDb } from './db.js'
import { tasksRouter, habitsRouter, areasRouter } from './routes.js'

// ── Init DB ───────────────────────────────────────────────────────────────────
// Create the tables if they don't exist yet (safe to run every startup).
initDb()

// The same secret signs AND verifies our JWTs, so the server can't run without
// it. Fail loudly and early rather than mysteriously rejecting every login.
if (!process.env.SESSION_SECRET) {
    console.error('\n✖  SESSION_SECRET is not set. JWT signing/verification will fail.\n   Set SESSION_SECRET in your environment variables.\n')
    process.exit(1)
}

const app = express()

// In production we sit behind Railway's HTTPS proxy; this lets secure cookies work.
app.set('trust proxy', 1)

// Where the frontend is served from (used for CORS and OAuth redirects).
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

app.use(express.json())                                       // parse JSON request bodies
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))   // allow the frontend to call us
// A session cookie is only needed briefly, during the Google login handshake.
// Once login finishes we issue a JWT and the app runs on that instead.
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,                                                    // JS can't read the cookie
        secure: process.env.NODE_ENV === 'production',                     // HTTPS-only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // cross-site in production
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
}))
app.use(passport.initialize())
app.use(passport.session())

// ── Google OAuth strategy ─────────────────────────────────────────────────────
// This block tells Passport how to handle a Google login. The callback runs
// AFTER Google confirms the user, with their `profile`. We upsert (insert or
// update) the user row, then hand the user object back to Passport.
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

// Passport stores just the user id in the session, then looks the full user up
// again on later requests. (Only used during the brief login handshake.)
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
// Step 1: the frontend sends the user here; Passport redirects them to Google.
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Step 2: Google sends the user back here. Passport runs the strategy above
// (creating req.user), then we issue a JWT and bounce the user to the frontend.
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${CLIENT_ORIGIN}?auth=error` }),
    (req, res) => {
        // Sign a token containing the user's basic info. We pass it back in the
        // URL (?token=...) rather than a cookie, because cross-domain cookies are
        // unreliable in Firefox/Safari. The frontend reads it in src/auth.js.
        const token = jwt.sign(
            { id: req.user.id, email: req.user.email, name: req.user.name, avatar: req.user.avatar },
            process.env.SESSION_SECRET,
            { expiresIn: '30d' }
        )
        res.redirect(`${CLIENT_ORIGIN}?token=${token}`)
    }
)

// Logout happens entirely on the client (it just forgets the token), so there's
// nothing to do here. Kept as a harmless endpoint in case something calls it.
app.post('/auth/logout', (_req, res) => res.json({ ok: true }))

// ── Health check ──────────────────────────────────────────────────────────────
// A simple "is the server up?" endpoint (used by hosting platforms and tests).
app.get('/', (_req, res) => res.json({ ok: true, service: 'resolve-api' }))

// ── requireAuth middleware ─────────────────────────────────────────────────────
// The gatekeeper for every /api/* route. It expects an "Authorization: Bearer
// <jwt>" header, verifies the token's signature with our secret, and on success
// puts the decoded user on `req.user` and calls next(). Any problem → 401, and
// the frontend (api.js) responds to a 401 by logging the user out.
function requireAuth(req, res, next) {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthenticated' })
    try {
        req.user = jwt.verify(auth.slice(7), process.env.SESSION_SECRET) // slice(7) drops "Bearer "
        next()
    } catch {
        return res.status(401).json({ error: 'unauthenticated' })
    }
}

// ── /api/me ───────────────────────────────────────────────────────────────────
// Echo back the signed-in user (handy for the client to confirm its token).
app.get('/api/me', requireAuth, (req, res) => res.json(req.user))

// ── /api/sync ──────────────────────────────────────────────────────────────────
// The frontend calls this once on startup to load EVERYTHING in a single
// request. We read the user's rows from each table and reshape them into the
// exact structure the frontend store keeps in memory (see syncAll in store.js):
//   { areas, tasksByDate, completedByDate, habitDefs, habitCompletions, habitExceptions }
// Reshaping here keeps the frontend simple — it can drop the response straight in.
app.get('/api/sync', requireAuth, (req, res) => {
    const uid = req.user.id

    // Areas → a flat array.
    const areas = db.prepare(
        'SELECT id, name, color FROM areas WHERE user_id = ? ORDER BY created_at'
    ).all(uid)

    // Tasks → tasksByDate / completedByDate
    const taskRows = db.prepare(
        'SELECT id, date_key, text, area_id, done, sort_order, parent_id FROM tasks WHERE user_id = ? ORDER BY sort_order, created_at'
    ).all(uid)
    const tasksByDate = {}
    const completedByDate = {}
    for (const t of taskRows) {
        const task = { id: t.id, text: t.text, areaId: t.area_id, sortOrder: t.sort_order ?? 0, parentId: t.parent_id ?? null }
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

// ── API routers ────────────────────────────────────────────────────────────────
// Mount the route groups from routes.js, each behind requireAuth so every
// endpoint inside is automatically protected.
app.use('/api/tasks', requireAuth, tasksRouter)
app.use('/api/habits', requireAuth, habitsRouter)
app.use('/api/areas', requireAuth, areasRouter)

// ── Serve built frontend in production ───────────────────────────────────────
// In development the frontend runs separately on Vite's dev server. In
// production (e.g. Railway) we build the frontend into ../dist and let this same
// server hand out those files, so one server serves both the app and the API.
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
const __dirname = dirname(fileURLToPath(import.meta.url)) // ESM has no __dirname; derive it
const distDir = join(__dirname, '..', 'dist')

if (existsSync(distDir)) {
    app.use(express.static(distDir)) // serve JS/CSS/images from the build
    // Single-page-app fallback: for any other path, return index.html and let
    // the Vue app handle routing in the browser. ('/{*path}' is Express 5's
    // catch-all syntax.)
    app.get('/{*path}', (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`\n  Server →  http://localhost:${PORT}`)
    console.log(`  Auth   →  http://localhost:${PORT}/auth/google\n`)
})
