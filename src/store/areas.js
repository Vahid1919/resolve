/**
 * Area store — manages named, color-coded project areas.
 *
 * Areas shape: { id: number, name: string, color: string }
 *
 * When an area is deleted, all task and habit references to it are cleared.
 */

import { reactive } from 'vue'
import { api } from '../api.js'
import { tasksByDate, completedByDate } from './tasks.js'
import { habitDefs } from './habits.js'

// ── Reactive state (populated via loadAreasFromSync on app boot) ──────────────
export const areas = reactive([])

// ── Hydrate from /api/sync response ──────────────────────────────────────────
export function loadAreasFromSync({ areas: a }) {
    areas.splice(0, areas.length, ...a)
}

// ── Operations ────────────────────────────────────────────────────────────────

export function addArea(name, color) {
    if (!name.trim()) return
    const tempId = Date.now()
    areas.push({ id: tempId, name: name.trim(), color })
    api.createArea(name, color).then(({ id }) => {
        const a = areas.find(a => a.id === tempId)
        if (a) a.id = id
    }).catch(() => {
        const idx = areas.findIndex(a => a.id === tempId)
        if (idx !== -1) areas.splice(idx, 1)
    })
}

export function removeArea(id) {
    const idx = areas.findIndex(a => a.id === id)
    if (idx !== -1) {
        areas.splice(idx, 1)
        api.deleteArea(id).catch(() => { })
    }

    // Clear the deleted area from all tasks and habits
    for (const tasks of Object.values(tasksByDate)) {
        for (const task of tasks) {
            if (task.areaId === id) task.areaId = null
        }
    }
    for (const tasks of Object.values(completedByDate)) {
        for (const task of tasks) {
            if (task.areaId === id) task.areaId = null
        }
    }
    for (const habit of habitDefs) {
        if (habit.areaId === id) habit.areaId = null
    }
}

export function updateArea(id, fields) {
    const area = areas.find(a => a.id === id)
    if (!area) return
    if (fields.name !== undefined) area.name = fields.name.trim() || area.name
    if (fields.color !== undefined) area.color = fields.color
    api.updateArea(id, area.name, area.color).catch(() => { })
}

/** Returns the hex color for an area id, or null if not found. */
export function getAreaColor(id) {
    return areas.find(a => a.id === id)?.color ?? null
}

/** Returns the display name for an area id, or '' if not found. */
export function getAreaName(id) {
    return areas.find(a => a.id === id)?.name ?? ''
}
