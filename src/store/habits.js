/**
 * Habit store — manages recurring habit definitions and daily completions.
 *
 * Habits are template-based: a HabitDef describes the recurrence rule,
 * and separate maps track per-day exceptions and completions.
 *
 * HabitDef shape:
 *   { id, text, cadence: 'daily'|'weekly'|'custom', customDays: number[],
 *     startDate: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', areaId: number|null }
 */

import { reactive, watch } from 'vue'
import { loadList, loadMap, save } from './storage.js'

// ── Reactive state ────────────────────────────────────────────────────────────
export const habitDefs = reactive(loadList('habits'))
export const habitExceptions = reactive(loadMap('habitExceptions'))  // { [dateKey]: id[] }
export const habitCompletions = reactive(loadMap('habitDone'))         // { [dateKey]: id[] }

// ── Persistence watchers ──────────────────────────────────────────────────────
watch(habitDefs, v => save('habits', v), { deep: true })
watch(habitExceptions, v => save('habitExceptions', v), { deep: true })
watch(habitCompletions, v => save('habitDone', v), { deep: true })

// ── Private date helpers ──────────────────────────────────────────────────────

function dayOfWeek(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() // 0 = Sunday
}

function prevDateKey(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Returns true if a habit definition applies on the given date. */
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

// ── Operations ────────────────────────────────────────────────────────────────

export function addHabit(text, cadence = 'daily', customDays = [], startDate, areaId = null) {
    if (!text.trim()) return
    habitDefs.push({
        id: Date.now(),
        text: text.trim(),
        cadence,
        customDays: cadence === 'custom' ? [...customDays] : [],
        startDate: startDate || new Date().toISOString().slice(0, 10),
        areaId,
    })
}

/** Skip this habit on one specific day only. */
export function skipHabitOnDate(dateKey, id) {
    if (!habitExceptions[dateKey]) habitExceptions[dateKey] = []
    if (!habitExceptions[dateKey].includes(id)) habitExceptions[dateKey].push(id)
}

/** Remove a habit starting from a given date — or entirely if that date is the start. */
export function removeHabitFromDate(id, fromDateKey) {
    const idx = habitDefs.findIndex(h => h.id === id)
    if (idx === -1) return
    const habit = habitDefs[idx]
    if (fromDateKey <= habit.startDate) {
        habitDefs.splice(idx, 1)            // deleting from the start = remove entirely
    } else {
        habit.endDate = prevDateKey(fromDateKey)
    }
}

export function getHabitsForDate(dateKey) {
    return habitDefs.filter(h => isApplicable(h, dateKey))
}

export function isHabitDone(dateKey, id) {
    return (habitCompletions[dateKey] || []).includes(id)
}

export function completeHabit(dateKey, id) {
    if (!habitCompletions[dateKey]) habitCompletions[dateKey] = []
    if (!habitCompletions[dateKey].includes(id)) habitCompletions[dateKey].push(id)
}

export function uncompleteHabit(dateKey, id) {
    const list = habitCompletions[dateKey]
    if (!list) return
    const idx = list.indexOf(id)
    if (idx !== -1) list.splice(idx, 1)
}

export function setHabitArea(id, areaId) {
    const habit = habitDefs.find(h => h.id === id)
    if (habit) habit.areaId = areaId
}
