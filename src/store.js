/**
 * store.js — the single source of truth for everything the user sees.
 *
 * This one file holds ALL of the app's data (tasks, habits, areas) and every
 * function that changes that data. Components never talk to the server directly
 * for app data — they call functions here, and these functions update the local
 * state immediately and tell the server in the background.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  How the pieces fit together
 * ──────────────────────────────────────────────────────────────────────────────
 *   • The state below is "reactive" (from Vue). When it changes, any component
 *     showing that data re-renders automatically. We never reassign these
 *     consts — we always mutate them in place (push/splice/assign), because the
 *     components hold a reference to the original object.
 *
 *   • Most actions use the "optimistic update" pattern (explained above addTask):
 *     change the screen instantly, then save to the server, and undo if the save
 *     fails. This makes the app feel fast.
 *
 *   • On startup, syncAll() downloads everything from the server in one request
 *     and fills the state in.
 *
 *   • Components don't import these functions one by one. They call useStore()
 *     (at the very bottom) to get them all in a single bundle.
 *
 *  Sections in this file:  STATE · SYNC · TASKS · HABITS · AREAS · CALENDAR · useStore
 */

import { reactive } from 'vue'
import { api } from './api.js'
import { parseDateKey, prevDateKey } from './utils.js'

// ══════════════════════════════════════════════════════════════════════════════
//  STATE  (the data, kept in memory and mirrored on the server)
// ══════════════════════════════════════════════════════════════════════════════

// Tasks are grouped by day. Each key is a dateKey ("YYYY-MM-DD"), each value is
// an array of task objects: { id, text, areaId, parentId, sortOrder }.
export const tasksByDate = reactive({})      // not-yet-done tasks, per day
export const completedByDate = reactive({})  // finished tasks, per day

// Habit DEFINITIONS describe a recurring habit (the rule), not a single day.
// Shape: { id, text, cadence:'daily'|'weekly'|'custom', customDays:number[],
//          startDate, endDate?, areaId }
export const habitDefs = reactive([])
// Per-day overrides for those definitions, each is { [dateKey]: habitId[] }:
export const habitExceptions = reactive({})   // habit was skipped on this day
export const habitCompletions = reactive({})  // habit was checked off on this day

// Areas are color-coded labels (e.g. "Work", "Health"): { id, name, color }.
export const areas = reactive([])

// ══════════════════════════════════════════════════════════════════════════════
//  SYNC  (load everything from the server once, on startup)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Empty a reactive object IN PLACE (delete every key) without replacing it.
 * We can't write `tasksByDate = {}` because components are watching the original
 * object — we'd lose reactivity. So we delete the keys one by one instead.
 */
function clearObject(obj) {
    for (const key of Object.keys(obj)) delete obj[key]
}

/**
 * Download the signed-in user's entire dataset from GET /api/sync and copy it
 * into the reactive state above. Called once when the app loads (see App.vue).
 * The server already returns the data in exactly the shape we store it in.
 */
export async function syncAll() {
    const data = await api.sync()

    // Areas — replace the whole array in place.
    areas.splice(0, areas.length, ...data.areas)

    // Tasks — wipe then refill both day-maps.
    clearObject(tasksByDate)
    Object.assign(tasksByDate, data.tasksByDate)
    clearObject(completedByDate)
    Object.assign(completedByDate, data.completedByDate)

    // Habits — definitions plus the per-day completion/exception maps.
    habitDefs.splice(0, habitDefs.length, ...data.habitDefs)
    clearObject(habitExceptions)
    Object.assign(habitExceptions, data.habitExceptions)
    clearObject(habitCompletions)
    Object.assign(habitCompletions, data.habitCompletions)
}

// ══════════════════════════════════════════════════════════════════════════════
//  TASKS
// ══════════════════════════════════════════════════════════════════════════════

/** Return the (reactive) array of active tasks for a day, creating it if needed. */
export function getTasks(dateKey) {
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []
    return tasksByDate[dateKey]
}

/**
 * Add a new task to the top of a day's list.
 *
 * ── The "optimistic update" pattern (used by most actions in this file) ──
 *   1. Update the local state right away with a TEMPORARY id (Date.now()), so
 *      the user sees the task instantly.
 *   2. Ask the server to save it. The server replies with the REAL database id.
 *   3. Swap the temporary id for the real one.
 *   4. If the request fails, undo step 1 (remove the task we optimistically added).
 *
 * sortOrder = -1 means "sort before everything else", i.e. show at the top.
 */
export async function addTask(dateKey, text, areaId = null, parentId = null) {
    if (!text.trim()) return
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = []

    const tempId = Date.now()
    tasksByDate[dateKey].unshift({ id: tempId, text: text.trim(), areaId, parentId, sortOrder: -1 })

    try {
        const { id } = await api.createTask(dateKey, text, areaId, parentId)
        const task = tasksByDate[dateKey]?.find(t => t.id === tempId)
        if (task) { task.id = id; task.sortOrder = -1 } // replace temp id with the real one
    } catch {
        // Save failed → roll back the optimistic insert.
        const idx = tasksByDate[dateKey]?.findIndex(t => t.id === tempId)
        if (idx != null && idx !== -1) tasksByDate[dateKey].splice(idx, 1)
    }
}

/** Permanently delete an active task. */
export function removeTask(dateKey, id) {
    const list = tasksByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(t => t.id === id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.deleteTask(id).catch(() => { }) // fire-and-forget; ignore network errors
    }
}

/** Mark a task done: move it from the active list to the completed list. */
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

/** Un-do "done": move a task from the completed list back to active. */
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

/** Return the array of completed tasks for a day (empty if none). */
export function getCompleted(dateKey) {
    return completedByDate[dateKey] || []
}

/** Permanently delete a completed task. */
export function removeCompleted(dateKey, id) {
    const list = completedByDate[dateKey]
    if (!list) return
    const idx = list.findIndex(c => c.id === id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.deleteCompleted(id).catch(() => { })
    }
}

/** Assign a task to an area (or null for "no area"). Works on active or done tasks. */
export function setTaskArea(dateKey, id, areaId) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
        ?? (completedByDate[dateKey] || []).find(t => t.id === id)
    if (task) {
        task.areaId = areaId
        api.setTaskArea(id, areaId).catch(() => { })
    }
}

/** Rename a task (inline editing). */
export function editTaskText(dateKey, id, text) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
    if (!task) return
    task.text = text
    api.updateTaskText(id, text).catch(() => { })
}

/**
 * Reorder within a day (drag-and-drop): move `movedId` to just before
 * `targetId`, or to the end if `targetId` is null. Afterwards every task's
 * sortOrder is renumbered to its new index, and each new order is saved.
 */
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
    // Renumber and persist the new positions.
    list.forEach((t, i) => {
        t.sortOrder = i
        api.reorderTask(t.id, i).catch(() => { })
    })
}

/** Move a task to a different day (drag onto a calendar cell). */
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

/** Turn a task into a subtask of another (or back to top-level with parentId=null). */
export function setTaskParent(dateKey, id, parentId) {
    const task = (tasksByDate[dateKey] || []).find(t => t.id === id)
    if (!task) return
    task.parentId = parentId
    api.setTaskParent(id, parentId).catch(() => { })
}

// ══════════════════════════════════════════════════════════════════════════════
//  HABITS
// ══════════════════════════════════════════════════════════════════════════════

/** Day of week for a dateKey: 0 = Sunday … 6 = Saturday. */
function dayOfWeek(dateKey) {
    return parseDateKey(dateKey).getDay()
}

/**
 * Does a habit definition apply on a given day? This is the heart of habit
 * recurrence. A habit shows up on a day only if ALL of these are true:
 *   • the day is on/after its startDate,
 *   • the day is on/before its endDate (if it has one),
 *   • it wasn't individually skipped on that day (an "exception"),
 *   • and the cadence matches:
 *       - daily  → every day
 *       - weekly → the same weekday as its startDate
 *       - custom → one of the chosen weekdays in customDays
 */
function isApplicable(habit, dateKey) {
    if (dateKey < habit.startDate) return false
    if (habit.endDate && dateKey > habit.endDate) return false
    if ((habitExceptions[dateKey] || []).includes(habit.id)) return false

    const dow = dayOfWeek(dateKey)
    if (habit.cadence === 'daily') return true
    if (habit.cadence === 'weekly') return dayOfWeek(habit.startDate) === dow
    if (habit.cadence === 'custom') return (habit.customDays || []).includes(dow)
    return false
}

/** Create a recurring habit (optimistic — see addTask for the pattern). */
export function addHabit(text, cadence = 'daily', customDays = [], startDate, areaId = null) {
    if (!text.trim()) return
    // Fall back to today if no start date was given (the UI always passes one).
    const sd = startDate || new Date().toISOString().slice(0, 10)
    const tempId = Date.now()
    habitDefs.push({
        id: tempId,
        text: text.trim(),
        cadence,
        customDays: cadence === 'custom' ? [...customDays] : [],
        startDate: sd,
        areaId,
    })
    api.createHabit({ text, cadence, customDays, startDate: sd, areaId }).then(({ id }) => {
        const habit = habitDefs.find(h => h.id === tempId)
        if (habit) habit.id = id
        // If the user checked off / skipped this habit before the server replied,
        // those records point at the temp id — repoint them to the real id.
        for (const k of Object.keys(habitCompletions)) {
            const i = habitCompletions[k].indexOf(tempId)
            if (i !== -1) habitCompletions[k][i] = id
        }
        for (const k of Object.keys(habitExceptions)) {
            const i = habitExceptions[k].indexOf(tempId)
            if (i !== -1) habitExceptions[k][i] = id
        }
    }).catch(() => {
        // Save failed → remove the optimistic habit.
        const idx = habitDefs.findIndex(h => h.id === tempId)
        if (idx !== -1) habitDefs.splice(idx, 1)
    })
}

/** Skip a habit on ONE day only (records an "exception" for that day). */
export function skipHabitOnDate(dateKey, id) {
    if (!habitExceptions[dateKey]) habitExceptions[dateKey] = []
    if (!habitExceptions[dateKey].includes(id)) {
        habitExceptions[dateKey].push(id)
        api.skipHabit(id, dateKey).catch(() => { })
    }
}

/**
 * Remove a habit from `fromDateKey` onward.
 *   • If that day is on/before the habit's start, delete the habit entirely.
 *   • Otherwise keep history intact and just set its endDate to the day before.
 */
export function removeHabitFromDate(id, fromDateKey) {
    const idx = habitDefs.findIndex(h => h.id === id)
    if (idx === -1) return
    const habit = habitDefs[idx]
    if (fromDateKey <= habit.startDate) {
        habitDefs.splice(idx, 1)
    } else {
        habit.endDate = prevDateKey(fromDateKey)
    }
    api.deleteHabit(id, fromDateKey).catch(() => { })
}

/** All habits that apply on a given day. */
export function getHabitsForDate(dateKey) {
    return habitDefs.filter(h => isApplicable(h, dateKey))
}

/** Has this habit been checked off on this day? */
export function isHabitDone(dateKey, id) {
    return (habitCompletions[dateKey] || []).includes(id)
}

/** Check a habit off for a day. */
export function completeHabit(dateKey, id) {
    if (!habitCompletions[dateKey]) habitCompletions[dateKey] = []
    if (!habitCompletions[dateKey].includes(id)) {
        habitCompletions[dateKey].push(id)
        api.completeHabit(id, dateKey).catch(() => { })
    }
}

/** Un-check a habit for a day. */
export function uncompleteHabit(dateKey, id) {
    const list = habitCompletions[dateKey]
    if (!list) return
    const idx = list.indexOf(id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.uncompleteHabit(id, dateKey).catch(() => { })
    }
}

/** Assign a habit to an area (or null). */
export function setHabitArea(id, areaId) {
    const habit = habitDefs.find(h => h.id === id)
    if (habit) {
        habit.areaId = areaId
        api.setHabitArea(id, areaId).catch(() => { })
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  AREAS  (color-coded labels for tasks and habits)
// ══════════════════════════════════════════════════════════════════════════════

/** Create an area (optimistic — see addTask for the pattern). */
export function addArea(name, color) {
    if (!name.trim()) return
    const tempId = Date.now()
    areas.push({ id: tempId, name: name.trim(), color })
    api.createArea(name, color).then(({ id }) => {
        const area = areas.find(a => a.id === tempId)
        if (area) area.id = id
    }).catch(() => {
        const idx = areas.findIndex(a => a.id === tempId)
        if (idx !== -1) areas.splice(idx, 1)
    })
}

/** Delete an area, and clear it off every task and habit that referenced it. */
export function removeArea(id) {
    const idx = areas.findIndex(a => a.id === id)
    if (idx !== -1) {
        areas.splice(idx, 1)
        api.deleteArea(id).catch(() => { })
    }

    // Un-tag any task/habit that pointed at the now-deleted area.
    for (const tasks of Object.values(tasksByDate)) {
        for (const task of tasks) if (task.areaId === id) task.areaId = null
    }
    for (const tasks of Object.values(completedByDate)) {
        for (const task of tasks) if (task.areaId === id) task.areaId = null
    }
    for (const habit of habitDefs) {
        if (habit.areaId === id) habit.areaId = null
    }
}

/** Update an area's name and/or color. `fields` is { name?, color? }. */
export function updateArea(id, fields) {
    const area = areas.find(a => a.id === id)
    if (!area) return
    if (fields.name !== undefined) area.name = fields.name.trim() || area.name
    if (fields.color !== undefined) area.color = fields.color
    api.updateArea(id, area.name, area.color).catch(() => { })
}

/** Look up an area's color by id (null if the area no longer exists). */
export function areaColor(id) {
    return areas.find(a => a.id === id)?.color ?? null
}

// ══════════════════════════════════════════════════════════════════════════════
//  CALENDAR COLOR  (tints each calendar day by how "done" it is)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * How complete is a day, from 0 (nothing done) to 1 (everything done)?
 * Returns null when there's nothing to show. "Items" = active tasks + done
 * tasks + applicable habits. Private helper — only calendarColorForDate uses it.
 */
function completionRatio(dateKey) {
    const cellDate = parseDateKey(dateKey)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const activeTasks = tasksByDate[dateKey] || []
    const doneTasks = completedByDate[dateKey] || []
    const habits = getHabitsForDate(dateKey)
    const doneHabits = (habitCompletions[dateKey] || []).length

    const total = activeTasks.length + doneTasks.length + habits.length
    if (total === 0) return null

    // A future day with nothing done yet stays uncolored.
    if (cellDate > todayStart && doneTasks.length === 0 && doneHabits === 0) return null

    return (doneTasks.length + doneHabits) / total
}

/**
 * Turn that ratio into a color, blending red → amber → green:
 *   0.0  → red       (nothing done)
 *   0.5  → amber     (halfway)
 *   1.0  → green     (all done)
 * The math is a linear interpolation ("lerp") between the RGB values of those
 * three colors. Returns null when there's nothing to show.
 */
export function calendarColorForDate(dateKey) {
    const ratio = completionRatio(dateKey)
    if (ratio === null) return null
    if (ratio === 0) return 'rgb(239,68,68)' // red
    if (ratio <= 0.5) {
        // Blend red → amber over the first half.
        const t = ratio * 2
        return `rgb(${Math.round(239 + (250 - 239) * t)},${Math.round(68 + (204 - 68) * t)},${Math.round(68 + (21 - 68) * t)})`
    }
    // Blend amber → green over the second half.
    const t = (ratio - 0.5) * 2
    return `rgb(${Math.round(250 + (34 - 250) * t)},${Math.round(204 + (197 - 204) * t)},${Math.round(21 + (94 - 21) * t)})`
}

// ══════════════════════════════════════════════════════════════════════════════
//  useStore()  — the one function components call to get everything above
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Bundle all state and actions into a single object so a component can write:
 *   const { getTasks, addTask, areas, areaColor, ... } = useStore()
 * Everything returned here is already reactive / shared app-wide.
 */
export function useStore() {
    return {
        // ── Tasks ──────────────────────────────────────────
        tasksByDate,
        getTasks,
        addTask,
        removeTask,
        archiveTask,
        unarchiveTask,
        getCompleted,
        removeCompleted,
        setTaskArea,
        editTaskText,
        reorderTasks,
        moveTaskToDate,
        setTaskParent,

        // ── Habits ─────────────────────────────────────────
        habitDefs,
        addHabit,
        skipHabitOnDate,
        removeHabitFromDate,
        getHabitsForDate,
        isHabitDone,
        completeHabit,
        uncompleteHabit,
        setHabitArea,

        // ── Areas ──────────────────────────────────────────
        areas,
        addArea,
        removeArea,
        updateArea,
        areaColor,

        // ── Calendar ───────────────────────────────────────
        calendarColorForDate,
    }
}
