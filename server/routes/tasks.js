import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// POST /api/tasks
router.post('/', (req, res) => {
    const { dateKey, text, areaId = null } = req.body
    if (!dateKey || !text?.trim()) return res.status(400).json({ error: 'dateKey and text required' })
    const result = db.prepare(
        'INSERT INTO tasks (user_id, date_key, text, area_id) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, dateKey, text.trim(), areaId)
    res.json({ id: result.lastInsertRowid, text: text.trim(), areaId })
})

// DELETE /api/tasks/:id  (active task)
router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? AND done = 0').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// DELETE /api/tasks/:id/completed
router.delete('/:id/completed', (req, res) => {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? AND done = 1').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/tasks/:id/complete  (move active → done)
router.post('/:id/complete', (req, res) => {
    db.prepare('UPDATE tasks SET done = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// POST /api/tasks/:id/uncomplete  (move done → active)
router.post('/:id/uncomplete', (req, res) => {
    db.prepare('UPDATE tasks SET done = 0 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/area
router.patch('/:id/area', (req, res) => {
    const { areaId = null } = req.body
    db.prepare('UPDATE tasks SET area_id = ? WHERE id = ? AND user_id = ?').run(areaId, req.params.id, req.user.id)
    res.json({ ok: true })
})

export default router
