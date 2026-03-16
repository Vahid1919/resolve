import { Router } from 'express'
import { db } from '../db.js'

const router = Router()

// POST /api/areas
router.post('/', (req, res) => {
    const { name, color } = req.body
    if (!name?.trim() || !color) return res.status(400).json({ error: 'name and color required' })
    const result = db.prepare(
        'INSERT INTO areas (user_id, name, color) VALUES (?, ?, ?)'
    ).run(req.user.id, name.trim(), color)
    res.json({ id: result.lastInsertRowid, name: name.trim(), color })
})

// PATCH /api/areas/:id
router.patch('/:id', (req, res) => {
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

// DELETE /api/areas/:id  (cascades area nullification in tasks/habits)
router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM areas WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    db.prepare('UPDATE tasks SET area_id = NULL WHERE area_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    db.prepare('UPDATE habit_defs SET area_id = NULL WHERE area_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    res.json({ ok: true })
})

export default router
