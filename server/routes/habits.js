import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

function prevDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// POST /api/habits
router.post('/', (req, res) => {
    const { text, cadence = 'daily', customDays = [], startDate, areaId = null } = req.body
    if (!text?.trim() || !startDate) return res.status(400).json({ error: 'text and startDate required' })
    const result = db.prepare(
        'INSERT INTO habit_defs (user_id, text, cadence, custom_days, start_date, area_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, text.trim(), cadence, JSON.stringify(customDays), startDate, areaId)
    res.json({ id: result.lastInsertRowid, text: text.trim(), cadence, customDays, startDate, areaId })
})

// DELETE /api/habits/:id  — body: { fromDate? }
router.delete('/:id', (req, res) => {
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

// POST /api/habits/:id/complete
router.post('/:id/complete', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare(
        'INSERT OR IGNORE INTO habit_completions (date_key, habit_id, user_id) VALUES (?, ?, ?)'
    ).run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/habits/:id/uncomplete
router.post('/:id/uncomplete', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare('DELETE FROM habit_completions WHERE date_key = ? AND habit_id = ? AND user_id = ?')
        .run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/habits/:id/skip
router.post('/:id/skip', (req, res) => {
    const { dateKey } = req.body
    if (!dateKey) return res.status(400).json({ error: 'dateKey required' })
    db.prepare(
        'INSERT OR IGNORE INTO habit_exceptions (date_key, habit_id, user_id) VALUES (?, ?, ?)'
    ).run(dateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/habits/:id/area
router.patch('/:id/area', (req, res) => {
    const { areaId = null } = req.body
    db.prepare('UPDATE habit_defs SET area_id = ? WHERE id = ? AND user_id = ?').run(areaId, req.params.id, req.user.id)
    res.json({ ok: true })
})

export default router
