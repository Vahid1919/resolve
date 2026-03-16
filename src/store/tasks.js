/**
 * Task store — manages active and completed tasks, keyed by date string (YYYY-MM-DD).
 *
 * Exports reactive state and all task-related operations.
 * Import from store/index.js via useStore() instead of using this directly.
 */

import { reactive, watch } from 'vue'
import { loadMap, save } from './storage.js'

// ── Reactive state ────────────────────────────────────────────────────────────
export const tasksByDate = reactive(loadMap('tasks'))
export const completedByDate = reactive(loadMap('completed'))

// ── Persistence watchers ──────────────────────────────────────────────────────
watch(tasksByDate, v => save('tasks', v), { deep: true })
watch(completedByDate, v => save('completed', v), { deep: true })

// ── Operations ────────────────────────────────────────────────────────────────

export function getTasks(dateKey) {
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    return tasksByDate[dateKey]
}

export function addTask(dateKey, text, areaId = null) {
    if (!text.trim()) return
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    tasksByDate[dateKey].push({ id: Date.now(), text: text.trim(), areaId })
}

export function removeTask(dateKey, id) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(t => t.id === id)
    if (idx !== -1) list.splice(idx, 1)
}

/** Move a task from active → completed archive. */
export function archiveTask(dateKey, id) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(t => t.id === id)
    if (idx === -1) return
    const [item] = list.splice(idx, 1)
    if (!completedByDate[dateKey]) completedByDate[dateKey] = []
    completedByDate[dateKey].unshift({ ...item, completedAt: Date.now() })
}

/** Move a task from completed archive → active. */
export function unarchiveTask(dateKey, id) {
    const list = completedByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(c => c.id === id)
    if (idx === -1) return
    const [item] = list.splice(idx, 1)
    const { completedAt, ...original } = item
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    tasksByDate[dateKey].push(original)
}

export function getCompleted(dateKey) {
    return completedByDate[dateKey] || []
}

export function removeCompleted(dateKey, id) {
    const list = completedByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(c => c.id === id)
    if (idx !== -1) list.splice(idx, 1)
}

export function setTaskArea(dateKey, id, areaId) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
    if (task) task.areaId = areaId
}
