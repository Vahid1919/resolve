/**
 * useStore() — single entry point for all application state.
 *
 * Composes the task, habit, and area stores, and adds the
 * calendar colour computation that depends on all three.
 *
 * Usage in any component:
 *   const { getTasks, addTask, areas, ... } = useStore()
 */

import { tasksByDate, completedByDate,
         getTasks, addTask, removeTask, archiveTask, unarchiveTask,
         getCompleted, removeCompleted, setTaskArea } from './tasks.js'

import { habitDefs, habitCompletions,
         addHabit, skipHabitOnDate, removeHabitFromDate,
         getHabitsForDate, isHabitDone, completeHabit, uncompleteHabit,
         setHabitArea } from './habits.js'

import { areas, addArea, removeArea, updateArea, getAreaColor, getAreaName } from './areas.js'

// ── Calendar colour helpers ───────────────────────────────────────────────────
//
// Returns a ratio in [0, 1] representing how complete a day is,
// or null if there is nothing tracked for that date.

function completionRatio(dateKey) {
  const cellDate   = new Date(...dateKey.split('-').map((v, i) => i === 1 ? v - 1 : +v))
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const activeTasks  = tasksByDate[dateKey] || []
  const doneTasks    = completedByDate[dateKey] || []
  const habits       = getHabitsForDate(dateKey)
  const doneHabits   = (habitCompletions[dateKey] || []).length

  const total = activeTasks.length + doneTasks.length + habits.length
  if (total === 0) return null

  // Future dates with nothing completed yet show no colour
  if (cellDate > todayStart && doneTasks.length === 0 && doneHabits === 0) return null

  return (doneTasks.length + doneHabits) / total
}

/**
 * Returns an RGB colour string representing the completion state of a date,
 * interpolating red → amber → green. Returns null if there is nothing to show.
 */
function calendarColorForDate(dateKey) {
  const ratio = completionRatio(dateKey)
  if (ratio === null) return null
  if (ratio === 0) return 'rgb(239,68,68)'
  if (ratio <= 0.5) {
    const t = ratio * 2
    return `rgb(${Math.round(239 + (250 - 239) * t)},${Math.round(68 + (204 - 68) * t)},${Math.round(68 + (21 - 68) * t)})`
  }
  const t = (ratio - 0.5) * 2
  return `rgb(${Math.round(250 + (34 - 250) * t)},${Math.round(204 + (197 - 204) * t)},${Math.round(21 + (94 - 21) * t)})`
}

// ── Public API ────────────────────────────────────────────────────────────────

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
    getAreaColor,
    getAreaName,

    // ── Calendar ───────────────────────────────────────
    calendarColorForDate,
    completionRatio,
  }
}
