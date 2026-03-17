import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// POST /api/tasks
router.post('/', (req, res) => {
    const { dateKey, text, areaId = null, parentId = null } = req.body
    if (!dateKey || !text?.trim()) return res.status(400).json({ error: 'dateKey and text required' })
    // New tasks go to the top: give them sort_order = -1 so they sort before existing ones
    const result = db.prepare(
        'INSERT INTO tasks (user_id, date_key, text, area_id, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, dateKey, text.trim(), areaId, parentId, -1)
    res.json({ id: result.lastInsertRowid, text: text.trim(), areaId, parentId, sortOrder: -1 })
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

// PATCH /api/tasks/:id/text
router.patch('/:id/text', (req, res) => {
    const { text } = req.body
    if (!text?.trim()) return res.status(400).json({ error: 'text required' })
    db.prepare('UPDATE tasks SET text = ? WHERE id = ? AND user_id = ?').run(text.trim(), req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/date  — move task to a different date
router.patch('/:id/date', (req, res) => {
    const { toDateKey } = req.body
    if (!toDateKey) return res.status(400).json({ error: 'toDateKey required' })
    db.prepare('UPDATE tasks SET date_key = ? WHERE id = ? AND user_id = ?').run(toDateKey, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/order  — update sort position
router.patch('/:id/order', (req, res) => {
    const { sortOrder = 0 } = req.body
    db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ? AND user_id = ?').run(sortOrder, req.params.id, req.user.id)
    res.json({ ok: true })
})

// PATCH /api/tasks/:id/parent  — set or clear subtask parent
router.patch('/:id/parent', (req, res) => {
    const { parentId = null } = req.body
    db.prepare('UPDATE tasks SET parent_id = ? WHERE id = ? AND user_id = ?').run(parentId, req.params.id, req.user.id)
    res.json({ ok: true })
})

export default router
