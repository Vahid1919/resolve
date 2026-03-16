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

import { reactive } from 'vue'
import { api } from '../api.js'

// ── Reactive state (populated via loadHabitsFromSync on app boot) ─────────────
export const habitDefs = reactive([])
export const habitExceptions = reactive({})  // { [dateKey]: id[] }
export const habitCompletions = reactive({}) // { [dateKey]: id[] }

// ── Hydrate from /api/sync response ──────────────────────────────────────────
export function loadHabitsFromSync({ habitDefs: h, habitCompletions: c, habitExceptions: e }) {
    habitDefs.splice(0, habitDefs.length, ...h)
    Object.keys(habitExceptions).forEach(k => delete habitExceptions[k])
    Object.assign(habitExceptions, e)
    Object.keys(habitCompletions).forEach(k => delete habitCompletions[k])
    Object.assign(habitCompletions, c)
}

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
        const h = habitDefs.find(h => h.id === tempId)
        if (h) h.id = id
        // Migrate any completions/exceptions recorded with the temp id
        for (const k of Object.keys(habitCompletions)) {
            const i = habitCompletions[k].indexOf(tempId)
            if (i !== -1) habitCompletions[k][i] = id
        }
        for (const k of Object.keys(habitExceptions)) {
            const i = habitExceptions[k].indexOf(tempId)
            if (i !== -1) habitExceptions[k][i] = id
        }
    }).catch(() => {
        const idx = habitDefs.findIndex(h => h.id === tempId)
        if (idx !== -1) habitDefs.splice(idx, 1)
    })
}

/** Skip this habit on one specific day only. */
export function skipHabitOnDate(dateKey, id) {
    if (!habitExceptions[dateKey]) habitExceptions[dateKey] = []
    if (!habitExceptions[dateKey].includes(id)) {
        habitExceptions[dateKey].push(id)
        api.skipHabit(id, dateKey).catch(() => { })
    }
}

/** Remove a habit starting from a given date — or entirely if that date is the start. */
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

export function getHabitsForDate(dateKey) {
    return habitDefs.filter(h => isApplicable(h, dateKey))
}

export function isHabitDone(dateKey, id) {
    return (habitCompletions[dateKey] || []).includes(id)
}

export function completeHabit(dateKey, id) {
    if (!habitCompletions[dateKey]) habitCompletions[dateKey] = []
    if (!habitCompletions[dateKey].includes(id)) {
        habitCompletions[dateKey].push(id)
        api.completeHabit(id, dateKey).catch(() => { })
    }
}

export function uncompleteHabit(dateKey, id) {
    const list = habitCompletions[dateKey]
    if (!list) return
    const idx = list.indexOf(id)
    if (idx !== -1) {
        list.splice(idx, 1)
        api.uncompleteHabit(id, dateKey).catch(() => { })
    }
}

export function setHabitArea(id, areaId) {
    const habit = habitDefs.find(h => h.id === id)
    if (habit) {
        habit.areaId = areaId
        api.setHabitArea(id, areaId).catch(() => { })
    }
}
