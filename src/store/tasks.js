import { reactive } from 'vue'
import { api } from '../api.js'

// ── Reactive state (populated via loadFromSync on app boot) ───────────────────
export const tasksByDate = reactive({})
export const completedByDate = reactive({})

// ── Hydrate from /api/sync response ──────────────────────────────────────────
export function loadTasksFromSync({ tasksByDate: t, completedByDate: c }) {
    Object.keys(tasksByDate).forEach(k => delete tasksByDate[k])
    Object.keys(completedByDate).forEach(k => delete completedByDate[k])
    Object.assign(tasksByDate, t)
    Object.assign(completedByDate, c)
}

// ── Operations ────────────────────────────────────────────────────────────────

export function getTasks(dateKey) {
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    return tasksByDate[dateKey]
}

export async function addTask(dateKey, text, areaId = null, parentId = null) {
    if (!text.trim()) return
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    const tempId = Date.now()
    const sortOrder = -1
    tasksByDate[dateKey].unshift({ id: tempId, text: text.trim(), areaId, parentId, sortOrder })
    try {
        const { id } = await api.createTask(dateKey, text, areaId, parentId)
        const t = tasksByDate[dateKey]?.find(t => t.id === tempId)
        if (t) { t.id = id; t.sortOrder = -1 }
    } catch {
        const idx = tasksByDate[dateKey]?.findIndex(t => t.id === tempId)
        if (idx != null && idx !== -1) tasksByDate[dateKey].splice(idx, 1)
    }
}

export function removeTask(dateKey, id) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(t => t.id === id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.deleteTask(id).catch(() => { })
    }
}

/** Move a task from active → completed archive. */
export function archiveTask(dateKey, id) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(t => t.id === id)
    if (idx === -1) return
    const [item] = list.splice(idx, 1)
    if (!completedByDate[dateKey]) completedByDate[dateKey] = []
    completedByDate[dateKey].unshift(item)
    api.completeTask(id).catch(() => { })
}

/** Move a task from completed archive → active. */
export function unarchiveTask(dateKey, id) {
    const list = completedByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(c => c.id === id)
    if (idx === -1) return
    const [item] = list.splice(idx, 1)
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    tasksByDate[dateKey].push(item)
    api.uncompleteTask(id).catch(() => { })
}

export function getCompleted(dateKey) {
    return completedByDate[dateKey] || []
}

export function removeCompleted(dateKey, id) {
    const list = completedByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(c => c.id === id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.deleteCompleted(id).catch(() => { })
    }
}

export function setTaskArea(dateKey, id, areaId) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
        ?? (completedByDate[dateKey] || []).find(t => t.id === id)
    if (task) {
        task.areaId = areaId
        api.setTaskArea(id, areaId).catch(() => { })
    }
}

export function editTaskText(dateKey, id, text) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
    if (!task) return
    task.text = text
    api.updateTaskText(id, text).catch(() => { })
}

/** Reorder: move movedId to just before targetId (or to end if targetId is null). */
export function reorderTasks(dateKey, movedId, targetId) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const fromIdx = list.findIndex(t => t.id === movedId)
    if (fromIdx === -1) return
    const [moved] = list.splice(fromIdx, 1)
    if (targetId === null) {
        list.push(moved)
    } else {
        const toIdx = list.findIndex(t => t.id === targetId)
        list.splice(toIdx === -1 ? list.length : toIdx, 0, moved)
    }
    list.forEach((t, i) => {
        t.sortOrder = i
        api.reorderTask(t.id, i).catch(() => { })
    })
}

/** Move a task from one date to another. */
export function moveTaskToDate(fromDateKey, id, toDateKey) {
    if (fromDateKey === toDateKey) return
    const fromList = tasksByDate[fromDateKey]
    if (!fromList) return
    const idx = fromList.findIndex(t => t.id === id)
    if (idx === -1) return
    const [task] = fromList.splice(idx, 1)
    if (!tasksByDate[toDateKey]) tasksByDate[toDateKey] = []
    tasksByDate[toDateKey].push(task)
    api.moveTaskDate(id, toDateKey).catch(() => { })
}

export function setTaskParent(dateKey, id, parentId) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
    if (!task) return
    task.parentId = parentId
    api.setTaskParent(id, parentId).catch(() => { })
}
