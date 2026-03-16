import { reactive, watch } from 'vue'

const TASKS_KEY = 'trackr-todos'
const COMPLETED_KEY = 'trackr-completed'   // task archive
const HABIT_DEFS_KEY = 'trackr-habit-defs'  // global habit templates []
const HABIT_EXC_KEY = 'trackr-habit-exc'   // { [dateKey]: templateId[] }
const HABIT_DONE_KEY = 'trackr-habit-done'  // { [dateKey]: templateId[] }
const AREAS_KEY = 'trackr-areas'         // [{ id, name, color }]

function loadObj(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : {} } catch { return {} }
}
function loadArr(key) {
    try { const r = localStorage.getItem(key); const v = r ? JSON.parse(r) : []; return Array.isArray(v) ? v : [] } catch { return [] }
}

const todosByDate = reactive(loadObj(TASKS_KEY))
const completedByDate = reactive(loadObj(COMPLETED_KEY))
const habitDefs = reactive(loadArr(HABIT_DEFS_KEY))
const habitExc = reactive(loadObj(HABIT_EXC_KEY))
const habitDone = reactive(loadObj(HABIT_DONE_KEY))
const areas = reactive(loadArr(AREAS_KEY))

watch(todosByDate, v => localStorage.setItem(TASKS_KEY, JSON.stringify(v)), { deep: true })
watch(completedByDate, v => localStorage.setItem(COMPLETED_KEY, JSON.stringify(v)), { deep: true })
watch(habitDefs, v => localStorage.setItem(HABIT_DEFS_KEY, JSON.stringify(v)), { deep: true })
watch(habitExc, v => localStorage.setItem(HABIT_EXC_KEY, JSON.stringify(v)), { deep: true })
watch(habitDone, v => localStorage.setItem(HABIT_DONE_KEY, JSON.stringify(v)), { deep: true })
watch(areas, v => localStorage.setItem(AREAS_KEY, JSON.stringify(v)), { deep: true })

function _dow(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    return new Date(y, m - 1, d).getDay() // 0=Sun
}

function _prevDay(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, m - 1, d - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function _isApplicable(tmpl, dateKey) {
    if (dateKey < tmpl.startDate) return false
    if (tmpl.endDate && dateKey > tmpl.endDate) return false
    if ((habitExc[dateKey] || []).includes(tmpl.id)) return false
    const dow = _dow(dateKey)
    if (tmpl.cadence === 'daily') return true
    if (tmpl.cadence === 'weekly') return _dow(tmpl.startDate) === dow
    if (tmpl.cadence === 'custom') return (tmpl.customDays || []).includes(dow)
    return false
}

export function useTodos() {
    // ── Tasks ──────────────────────────────────────────────
    function getTodos(dateKey) {
        if (!todosByDate[dateKey]) todosByDate[dateKey] = []
        return todosByDate[dateKey]
    }

    function addTodo(dateKey, text, areaId = null) {
        if (!text.trim()) return
        if (!todosByDate[dateKey]) todosByDate[dateKey] = []
        todosByDate[dateKey].push({ id: Date.now(), text: text.trim(), areaId })
    }

    function removeTodo(dateKey, id) {
        if (!todosByDate[dateKey]) return
        const idx = todosByDate[dateKey].findIndex(t => t.id === id)
        if (idx !== -1) todosByDate[dateKey].splice(idx, 1)
    }

    function archiveTodo(dateKey, id) {
        if (!todosByDate[dateKey]) return
        const idx = todosByDate[dateKey].findIndex(t => t.id === id)
        if (idx === -1) return
        const [item] = todosByDate[dateKey].splice(idx, 1)
        if (!completedByDate[dateKey]) completedByDate[dateKey] = []
        completedByDate[dateKey].unshift({ ...item, completedAt: Date.now(), type: 'task' })
    }

    function getCompleted(dateKey) {
        return (completedByDate[dateKey] || []).filter(c => c.type === 'task')
    }

    function removeCompleted(dateKey, id) {
        if (!completedByDate[dateKey]) return
        const idx = completedByDate[dateKey].findIndex(c => c.id === id)
        if (idx !== -1) completedByDate[dateKey].splice(idx, 1)
    }

    function unarchiveTodo(dateKey, id) {
        if (!completedByDate[dateKey]) return
        const idx = completedByDate[dateKey].findIndex(c => c.id === id)
        if (idx === -1) return
        const [item] = completedByDate[dateKey].splice(idx, 1)
        const { completedAt, type, ...original } = item
        if (!todosByDate[dateKey]) todosByDate[dateKey] = []
        todosByDate[dateKey].push(original)
    }

    // ── Habits (global template-based) ────────────────────
    // cadence: 'daily' | 'weekly' | 'custom'
    // customDays: number[] (0=Sun … 6=Sat)
    function addHabitDef(text, cadence = 'daily', customDays = [], startDate, areaId = null) {
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

    // "delete this day only" — add exception
    function addHabitException(dateKey, id) {
        if (!habitExc[dateKey]) habitExc[dateKey] = []
        if (!habitExc[dateKey].includes(id)) habitExc[dateKey].push(id)
    }

    // "delete this day & all future" — cut endDate or remove template
    function removeHabitDefFromDate(id, fromDateKey) {
        const idx = habitDefs.findIndex(h => h.id === id)
        if (idx === -1) return
        const tmpl = habitDefs[idx]
        if (fromDateKey <= tmpl.startDate) {
            habitDefs.splice(idx, 1) // deleting from start = remove entirely
        } else {
            tmpl.endDate = _prevDay(fromDateKey)
        }
    }

    function getHabitsForDate(dateKey) {
        return habitDefs.filter(tmpl => _isApplicable(tmpl, dateKey))
    }

    function isHabitDone(dateKey, id) {
        return (habitDone[dateKey] || []).includes(id)
    }

    function completeHabit(dateKey, id) {
        if (!habitDone[dateKey]) habitDone[dateKey] = []
        if (!habitDone[dateKey].includes(id)) habitDone[dateKey].push(id)
    }

    function uncompleteHabit(dateKey, id) {
        if (!habitDone[dateKey]) return
        const idx = habitDone[dateKey].indexOf(id)
        if (idx !== -1) habitDone[dateKey].splice(idx, 1)
    }

    function setTodoArea(dateKey, id, areaId) {
        if (!todosByDate[dateKey]) return
        const t = todosByDate[dateKey].find(t => t.id === id)
        if (t) t.areaId = areaId
    }

    function setHabitArea(id, areaId) {
        const h = habitDefs.find(h => h.id === id)
        if (h) h.areaId = areaId
    }

    // ── Areas ──────────────────────────────────────────────
    function addArea(name, color) {
        if (!name.trim()) return
        areas.push({ id: Date.now(), name: name.trim(), color })
    }

    function removeArea(id) {
        const idx = areas.findIndex(a => a.id === id)
        if (idx !== -1) areas.splice(idx, 1)
        for (const dk of Object.keys(todosByDate)) {
            for (const t of todosByDate[dk]) { if (t.areaId === id) t.areaId = null }
        }
        for (const h of habitDefs) { if (h.areaId === id) h.areaId = null }
    }

    function updateArea(id, fields) {
        const a = areas.find(a => a.id === id)
        if (!a) return
        if (fields.name !== undefined) a.name = fields.name.trim() || a.name
        if (fields.color !== undefined) a.color = fields.color
    }

    // ── Calendar colour helpers ────────────────────────────
    function _ratio(dateKey) {
        const cellDate = new Date(...dateKey.split('-').map((v, i) => i === 1 ? v - 1 : +v))
        const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)

        const activeTasks = todosByDate[dateKey] || []
        const doneTasks = (completedByDate[dateKey] || []).filter(c => c.type === 'task')
        const habits = habitDefs.filter(h => _isApplicable(h, dateKey))
        const doneHabits = (habitDone[dateKey] || []).length

        const total = activeTasks.length + doneTasks.length + habits.length
        if (total === 0) return null
        // future dates with nothing completed yet show no colour
        if (cellDate > todayMidnight && doneTasks.length === 0 && doneHabits === 0) return null

        return (doneTasks.length + doneHabits) / total
    }

    function getDateColor(dateKey) {
        const ratio = _ratio(dateKey)
        if (ratio === null) return null
        if (ratio === 0) return 'rgb(239,68,68)'
        if (ratio <= 0.5) {
            const t = ratio * 2
            return `rgb(${Math.round(239 + (250 - 239) * t)},${Math.round(68 + (204 - 68) * t)},${Math.round(68 + (21 - 68) * t)})`
        } else {
            const t = (ratio - 0.5) * 2
            return `rgb(${Math.round(250 + (34 - 250) * t)},${Math.round(204 + (197 - 204) * t)},${Math.round(21 + (94 - 21) * t)})`
        }
    }

    function getCompletionRatio(dateKey) {
        return _ratio(dateKey) ?? 0
    }

    return {
        todosByDate,
        getTodos, addTodo, removeTodo, archiveTodo, unarchiveTodo,
        getCompleted, removeCompleted,
        addHabitDef, addHabitException, removeHabitDefFromDate,
        getHabitsForDate, isHabitDone, completeHabit, uncompleteHabit,
        setTodoArea, setHabitArea,
        areas, addArea, removeArea, updateArea,
        getDateColor, getCompletionRatio,
    }
}
