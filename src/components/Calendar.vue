<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store/index.js'

const emit = defineEmits(['select'])

const { calendarColorForDate, tasksByDate } = useStore()

// ── Today reference ───────────────────────────────────────────────────────────
const today = new Date()
today.setHours(0, 0, 0, 0)

function makeDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
const todayKey = makeDateKey(today.getFullYear(), today.getMonth(), today.getDate())

// ── View state ────────────────────────────────────────────────────────────────
const viewYear    = ref(today.getFullYear())
const viewMonth   = ref(today.getMonth())
const selectedKey = ref(todayKey)

onMounted(() => emit('select', todayKey))

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Computed ──────────────────────────────────────────────────────────────────
const monthLabel  = computed(() => `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`)
const totalDays   = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())
const startOffset = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay())

// ── Navigation ────────────────────────────────────────────────────────────────
function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
function jumpToToday() {
  viewYear.value    = today.getFullYear()
  viewMonth.value   = today.getMonth()
  selectedKey.value = todayKey
  emit('select', todayKey, false)
}

// ── Day helpers ───────────────────────────────────────────────────────────────
function keyForDay(d) { return makeDateKey(viewYear.value, viewMonth.value, d) }
function isToday(d)    { return keyForDay(d) === todayKey }
function isSelected(d) { return keyForDay(d) === selectedKey.value }
function isPast(d)     { return new Date(viewYear.value, viewMonth.value, d) < today }

function taskDotCount(d) {
  return Math.min((tasksByDate[keyForDay(d)] || []).length, 4)
}
function cellStyle(d) {
  const color = calendarColorForDate(keyForDay(d))
  return color ? { backgroundColor: color } : {}
}
function cellAriaLabel(d) {
  const parts = [d, MONTH_NAMES[viewMonth.value], viewYear.value]
  if (isToday(d))    parts.push('(today)')
  if (isSelected(d)) parts.push('(selected)')
  if (isPast(d))     parts.push('(past)')
  return parts.join(' ')
}

function selectDay(d, past = false) {
  const key = keyForDay(d)
  selectedKey.value = key
  emit('select', key, past)
}

// ── Roving-tabindex keyboard navigation ───────────────────────────────────────
function handleDayKeydown(e, d) {
  const max = totalDays.value
  let next  = null
  if      (e.key === 'ArrowRight') next = d < max ? d + 1 : d
  else if (e.key === 'ArrowLeft')  next = d > 1   ? d - 1 : d
  else if (e.key === 'ArrowDown')  next = Math.min(d + 7, max)
  else if (e.key === 'ArrowUp')    next = Math.max(d - 7, 1)
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    selectDay(d, isPast(d))
    return
  }
  else return

  e.preventDefault()
  document.querySelector(`[data-day="${next}"]`)?.focus()
}
</script>

<template>
  <section
    aria-label="Monthly calendar"
    class="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7
           min-w-[300px] max-w-[560px] w-full flex-shrink-0 animate-slide-up
           max-md:max-w-full"
    style="box-shadow: var(--shadow)"
  >

    <!-- Month navigation toolbar -->
    <div
      role="toolbar"
      aria-label="Calendar navigation"
      class="flex items-center justify-between mb-6"
    >
      <button
        class="w-9 h-9 flex items-center justify-center rounded-[9px]
               border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]
               text-2xl cursor-pointer transition-colors
               hover:bg-[var(--surface3)] hover:border-[var(--accent)]
               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        @click="prevMonth"
        aria-label="Previous month"
      >&#8249;</button>

      <h2
        class="text-[19px] font-bold tracking-tight text-[var(--text)]"
        aria-live="polite" aria-atomic="true"
      >{{ monthLabel }}</h2>

      <div class="flex gap-1.5">
        <button
          class="w-9 h-9 flex items-center justify-center rounded-[9px]
                 border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]
                 text-2xl cursor-pointer transition-colors
                 hover:bg-[var(--surface3)] hover:border-[var(--accent)]
                 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          @click="nextMonth"
          aria-label="Next month"
        >&#8250;</button>
        <button
          class="h-9 px-3.5 rounded-[9px] border border-[var(--border)]
                 bg-[var(--surface2)] text-[var(--text-muted)] text-sm font-semibold
                 cursor-pointer transition-colors
                 hover:bg-[var(--surface3)] hover:border-[var(--accent)] hover:text-[var(--text)]
                 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          @click="jumpToToday"
          aria-label="Jump to today"
        >Today</button>
      </div>
    </div>

    <!-- Calendar grid -->
    <div
      role="grid"
      :aria-label="monthLabel + ' calendar'"
      class="grid grid-cols-7 gap-1.5"
    >
      <!-- Day-of-week column headers -->
      <div
        v-for="day in DAY_NAMES" :key="day"
        role="columnheader" :aria-label="day"
        class="text-center text-[11px] font-semibold text-[var(--text-muted)]
               uppercase tracking-wider pb-2.5"
        aria-hidden="true"
      >{{ day }}</div>

      <!-- Blank offset cells before the 1st -->
      <div
        v-for="n in startOffset" :key="'pad-' + n"
        role="gridcell" aria-hidden="true"
        class="min-h-[62px]"
      />

      <!-- Day cells -->
      <div
        v-for="d in totalDays" :key="d"
        role="gridcell"
        :aria-label="cellAriaLabel(d)"
        :aria-selected="isSelected(d)"
        :aria-current="isToday(d) ? 'date' : undefined"
        :data-day="d"
        :tabindex="isSelected(d) ? 0 : -1"
        :style="cellStyle(d)"
        class="min-h-[62px] rounded-[10px] flex flex-col items-center justify-center
               cursor-pointer border-[1.5px] border-transparent bg-[var(--surface2)]
               transition-all duration-200 select-none px-1 py-1.5 gap-0.5
               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        :class="{
          'opacity-50':                 isPast(d),
          'border-[var(--accent)]':     isSelected(d),
          'hover:border-[var(--accent)] hover:scale-[1.06] hover:z-[2]': !isPast(d),
          'hover:border-[var(--border)]': isPast(d),
        }"
        @click="selectDay(d, isPast(d))"
        @keydown="handleDayKeydown($event, d)"
      >
        <span
          class="text-[15px] text-[var(--text)]"
          :class="{ 'font-bold': isToday(d), 'font-medium': !isToday(d) }"
        >{{ d }}</span>

        <!-- Task indicator dots (up to 4) -->
        <span v-if="taskDotCount(d) > 0" class="flex gap-[3px]" aria-hidden="true">
          <span
            v-for="i in taskDotCount(d)" :key="i"
            class="w-[5px] h-[5px] rounded-full bg-[var(--accent)] opacity-90"
          />
        </span>
      </div>
    </div>

  </section>
</template>
