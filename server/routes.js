/**
 * routes.js — every data API endpoint, in one place.
 *
 * These are mounted in index.js behind the requireAuth middleware:
 *     app.use('/api/tasks',  requireAuth, tasksRouter)
 *     app.use('/api/habits', requireAuth, habitsRouter)
 *     app.use('/api/areas',  requireAuth, areasRouter)
 *
 * Because of that, by the time any handler below runs:
 *   • the user is authenticated, and
 *   • `req.user` holds the decoded token, so `req.user.id` is the current user.
 *
 * Every query is scoped with `WHERE ... user_id = ?` so one user can never read
 * or change another user's rows. We use better-sqlite3, whose `.run()` and
 * `.get()` calls are SYNCHRONOUS (no await needed) and use `?` placeholders to
 * safely insert values (this prevents SQL injection).
 *
 * Note: the frontend updates its own screen optimistically, so these handlers
 * mostly just persist the change and reply `{ ok: true }`. The create routes are
 * the exception — they return the new row's `id` so the client can replace its
 * temporary id with the real one.
 */

import { Router } from 'express'
import { db } from './db.js'

// ══════════════════════════════════════════════════════════════════════════════
//  TASKS  (mounted at /api/tasks)
// ══════════════════════════════════════════════════════════════════════════════
export const tasksRouter = Router()

// POST /api/tasks — create a task. New tasks get sort_order = -1 so they sort
// above everything else (i.e. appear at the top of the day).
tasksRouter.post('/', (req, res) => {
    const { dateKey, text, areaId = null, parentId = null } = req.body
    if (!dateKey || !text?.trim()) return res.status(400).json({ error: 'dateKey and text required' })
    const result = db.prepare(
        'INSERT INTO tasks (user_id, date_key, text, area_id, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, dateKey, text.trim(), areaId, parentId, -1)
    res.json({ id: result.lastInsertRowid, text: text.trim(), areaId, parentId, sortOrder: -1 })
})

// DELETE /api/tasks/:id — delete an ACTIVE task (done = 0).
tasksRouter.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? AND done = 0').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// DELETE /api/tasks/:id/completed — delete a COMPLETED task (done = 1).
tasksRouter.delete('/:id/completed', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? AND done = 1').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/tasks/:id/complete — mark done (active → completed).
tasksRouter.post('/:id/complete', (req, res) => {
    db.prepare('UPDATE tasks SET done = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/tasks/:id/uncomplete — mark not done (completed → active).
tasksRouter.post('/:id/uncomplete', (req, res) => {
    db.prepare('UPDATE tasks SET done = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/area — set or clear which area the task belongs to.
tasksRouter.patch('/:id/area', (req, res) => {
    const { areaId = null } = req.body
    db.prepare('UPDATE tasks SET area_id = ? WHERE id = ? AND user_id = ?').run(areaId, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/text — rename the task.
tasksRouter.patch('/:id/text', (req, res) => {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'text required' })
    db.prepare('UPDATE tasks SET text = ? WHERE id = ? AND user_id = ?').run(text.trim(), req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/date — move the task to another day.
tasksRouter.patch('/:id/date', (req, res) => {
    const { toDateKey } = req.body
    if (!toDateKey) return res.status(400).json({ error: 'toDateKey required' })
    db.prepare('UPDATE tasks SET date_key = ? WHERE id = ? AND user_id = ?').run(toDateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/order — save the task's new position (after a reorder).
tasksRouter.patch('/:id/order', (req, res) => {
    const { sortOrder = 0 } = req.body
    db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?').run(sortOrder, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/parent — make it a subtask (parentId) or top-level (null).
tasksRouter.patch('/:id/parent', (req, res) => {
    const { parentId = null } = req.body
    db.prepare('UPDATE tasks SET parent_id = ? WHERE id = ? AND user_id = ?').run(parentId, req.params.id, req.user.id)
    res.json({ ok: true })
})

// ══════════════════════════════════════════════════════════════════════════════
//  HABITS  (mounted at /api/habits)
// ══════════════════════════════════════════════════════════════════════════════
export const habitsRouter = Router()

// The dateKey for the day before `dateKey`. (Same logic as src/utils.js, but the
// server runs as plain Node and the frontend is bundled by Vite, so each keeps
// its own small copy rather than sharing a module across the two.)
function prevDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// POST /api/habits — create a recurring habit definition.
habitsRouter.post('/', (req, res) => {
    const { text, cadence = 'daily', customDays = [], startDate, areaId = null } = req.body
    if (!text?.trim() || !startDate) return res.status(400).json({ error: 'text and startDate required' })
    // customDays is an array (e.g. [1,3,5]); SQLite has no array type, so we
    // store it as a JSON string and parse it back out in /api/sync.
    const result = db.prepare(
        'INSERT INTO habit_defs (user_id, text, cadence, custom_days, start_date, area_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, text.trim(), cadence, JSON.stringify(customDays), startDate, areaId)
    res.json({ id: result.lastInsertRowid, text: text.trim(), cadence, customDays, startDate, areaId })
})

// DELETE /api/habits/:id — body: { fromDate? }
//   • no fromDate, or fromDate on/before the start → delete the habit entirely
//     (and its completion/exception history).
//   • otherwise → keep history and just end it the day before fromDate.
habitsRouter.delete('/:id', (req, res) => {
    const { fromDate } = req.body || {}
    const habit = db.prepare('SELECT * FROM habit_defs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!habit) return res.status(404).json({ error: 'not found' })

    if (!fromDate || fromDate <= habit.start_date) {
        db.prepare('DELETE FROM habit_defs WHERE id = ?').run(req.params.id)
        db.prepare('DELETE FROM habit_completions WHERE habit_id = ? AND user_id = ?').run(req.params.id, req.user.id)
        db.prepare('DELETE FROM habit_exceptions WHERE habit_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    } else {
        db.prepare('UPDATE habit_defs SET end_date = ? WHERE id = ?').run(prevDateKey(fromDate), req.params.id)
    }
    res.json({ ok: true })
})

// POST /api/habits/:id/complete — check the habit off for one day.
// "INSERT OR IGNORE" does nothing if it's already recorded (the table's primary
// key is the date+habit+user combination), so completing twice is harmless.
habitsRouter.post('/:id/complete', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare(
        'INSERT OR IGNORE INTO habit_completions (date_key, habit_id, user_id) VALUES (?, ?, ?)'
    ).run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/habits/:id/uncomplete — un-check the habit for one day.
habitsRouter.post('/:id/uncomplete', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare('DELETE FROM habit_completions WHERE date_key = ? AND habit_id = ? AND user_id = ?')
        .run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/habits/:id/skip — skip the habit on one day (records an exception).
habitsRouter.post('/:id/skip', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare(
        'INSERT OR IGNORE INTO habit_exceptions (date_key, habit_id, user_id) VALUES (?, ?, ?)'
    ).run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/habits/:id/area — set or clear the habit's area.
habitsRouter.patch('/:id/area', (req, res) => {
    const { areaId = null } = req.body
    db.prepare('UPDATE habit_defs SET area_id = ? WHERE id = ? AND user_id = ?').run(areaId, req.params.id, req.user.id)
    res.json({ ok: true })
})

// ══════════════════════════════════════════════════════════════════════════════
//  AREAS  (mounted at /api/areas)
// ══════════════════════════════════════════════════════════════════════════════
export const areasRouter = Router()

// POST /api/areas — create a color-coded area.
areasRouter.post('/', (req, res) => {
    const { name, color } = req.body
    if (!name?.trim() || !color) return res.status(400).json({ error: 'name and color required' })
    const result = db.prepare(
        'INSERT INTO areas (user_id, name, color) VALUES (?, ?, ?)'
    ).run(req.user.id, name.trim(), color)
    res.json({ id: result.lastInsertRowid, name: name.trim(), color })
})

// PATCH /api/areas/:id — rename / recolor. Missing fields keep their old value.
areasRouter.patch('/:id', (req, res) => {
    const area = db.prepare('SELECT * FROM areas WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!area) return res.status(404).json({ error: 'not found' })
    const { name, color } = req.body
    db.prepare('UPDATE areas SET name = ?, color = ? WHERE id = ?').run(
        name?.trim() || area.name,
        color || area.color,
        req.params.id
    )
    res.json({ ok: true })
})

// DELETE /api/areas/:id — delete the area, and un-tag any task/habit using it
// (set their area_id back to NULL) so nothing points at a missing area.
areasRouter.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM areas WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    db.prepare('UPDATE tasks SET area_id = NULL WHERE area_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    db.prepare('UPDATE habit_defs SET area_id = NULL WHERE area_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})
