<!--
  Calendar.vue — the month grid on the left side of the app.

  What it does:
    • Shows one month at a time; arrows move between months.
    • Tints each day by how complete it is (red→amber→green) via the store.
    • Shows up to 4 dots on a day to hint how many tasks it has.
    • Lets you click (or arrow-key) to select a day, and drag a task onto a day
      to move it there.
  It announces the chosen day to the parent (App.vue) with the "select" event.
-->
<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore, moveTaskToDate } from "../store.js";
import { toDateKey } from "../utils.js";

// The selected day ("YYYY-MM-DD") is owned by the parent (App.vue) and passed in
// as a prop, so the calendar's highlight always matches the day the app is
// showing — even when the day was picked elsewhere (e.g. from the week view).
const props = defineProps({
  selected: { type: String, default: null },
});

// Emitted as ("select", dateKey, isPast) whenever the user picks a day.
const emit = defineEmits(["select"]);

// calendarColorForDate → the day's tint; tasksByDate → used for the task dots.
const { calendarColorForDate, tasksByDate } = useStore();

// ── Today reference ───────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0); // midnight, so we can compare whole days cleanly
const todayKey = toDateKey(today);

// ── View state ────────────────────────────────────────────────────────────────
// Which month is on screen — independent of which day is selected.
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

// On first load, tell the parent that today is the selected day.
onMounted(() => emit("select", todayKey));

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Computed ──────────────────────────────────────────────────────────────────
const monthLabel = computed(
  () => `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`,
);
const totalDays = computed(() =>
  new Date(viewYear.value, viewMonth.value + 1, 0).getDate(),
);
const startOffset = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).getDay(),
);

// ── Navigation ────────────────────────────────────────────────────────────────
function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value--;
  } else viewMonth.value--;
}
function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value++;
  } else viewMonth.value++;
}
function jumpToToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
  emit("select", todayKey, false);
}

// ── Day helpers ───────────────────────────────────────────────────────────────
// The dateKey for day-number `d` within the month currently on screen.
function keyForDay(d) {
  return toDateKey(new Date(viewYear.value, viewMonth.value, d));
}
function isToday(d) {
  return keyForDay(d) === todayKey;
}
function isSelected(d) {
  return keyForDay(d) === props.selected;
}
function isPast(d) {
  return new Date(viewYear.value, viewMonth.value, d) < today;
}

function taskDotCount(d) {
  return Math.min((tasksByDate[keyForDay(d)] || []).length, 4);
}
function cellStyle(d) {
  const color = calendarColorForDate(keyForDay(d));
  return color ? { backgroundColor: color } : {};
}
function cellAriaLabel(d) {
  const parts = [d, MONTH_NAMES[viewMonth.value], viewYear.value];
  if (isToday(d)) parts.push("(today)");
  if (isSelected(d)) parts.push("(selected)");
  if (isPast(d)) parts.push("(past)");
  return parts.join(" ");
}

function selectDay(d, past = false) {
  // Don't track the selection here — emit it up to App.vue, which passes it
  // back down via the `selected` prop. That keeps one source of truth.
  emit("select", keyForDay(d), past);
}

// ── Task drag-to-calendar drop ─────────────────────────────────────────────────
// A task being dragged carries two pieces of data ("task-id" and "from-date"),
// set in TaskSection.vue when the drag starts. Dropping it on a day moves the
// task to that day. `dragOverDay` just tracks which cell to highlight.
const dragOverDay = ref(null);

// Only react to task drags (ignore any other dragged content). Calling
// preventDefault() on dragover is what tells the browser "a drop is allowed here".
function onDayDragOver(e, d) {
  if (!e.dataTransfer.types.includes("task-id")) return;
  e.preventDefault();
  dragOverDay.value = d;
}

function onDayDragLeave() {
  dragOverDay.value = null;
}

function onDayDrop(e, d) {
  e.preventDefault();
  const taskId = Number(e.dataTransfer.getData("task-id"));
  const fromDate = e.dataTransfer.getData("from-date");
  const toDate = keyForDay(d);
  if (taskId && fromDate && fromDate !== toDate) {
    moveTaskToDate(fromDate, taskId, toDate);
  }
  dragOverDay.value = null;
}

// ── Roving-tabindex keyboard navigation ───────────────────────────────────────
function handleDayKeydown(e, d) {
  const max = totalDays.value;
  let next = null;
  if (e.key === "ArrowRight") next = d < max ? d + 1 : d;
  else if (e.key === "ArrowLeft") next = d > 1 ? d - 1 : d;
  else if (e.key === "ArrowDown") next = Math.min(d + 7, max);
  else if (e.key === "ArrowUp") next = Math.max(d - 7, 1);
  else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    selectDay(d, isPast(d));
    return;
  } else return;

  e.preventDefault();
  document.querySelector(`[data-day="${next}"]`)?.focus();
}
</script>

<template>
  <section
    aria-label="Monthly calendar"
    class="bg-(--surface) border border-(--border) rounded-2xl p-7 min-w-75 max-w-140 w-full shrink-0 animate-slide-up max-md:max-w-full"
    style="box-shadow: var(--shadow)"
  >
    <!-- Month navigation toolbar -->
    <div
      role="toolbar"
      aria-label="Calendar navigation"
      class="flex items-center justify-between mb-6"
    >
      <button
        class="w-9 h-9 flex items-center justify-center rounded-[9px] border border-(--border) bg-(--surface2) text-(--text) text-2xl cursor-pointer transition-colors hover:bg-(--surface3) hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        @click="prevMonth"
        aria-label="Previous month"
      >
        &#8249;
      </button>

      <h2
        class="text-[19px] font-bold tracking-tight text-(--text)"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ monthLabel }}
      </h2>

      <div class="flex gap-1.5">
        <button
          class="w-9 h-9 flex items-center justify-center rounded-[9px] border border-(--border) bg-(--surface2) text-(--text) text-2xl cursor-pointer transition-colors hover:bg-(--surface3) hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)"
          @click="nextMonth"
          aria-label="Next month"
        >
          &#8250;
        </button>
        <button
          class="h-9 px-3.5 rounded-[9px] border border-(--border) bg-(--surface2) text-(--text-muted) text-sm font-semibold cursor-pointer transition-colors hover:bg-(--surface3) hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-2 focus:ring-(--accent)"
          @click="jumpToToday"
          aria-label="Jump to today"
        >
          Today
        </button>
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
        v-for="day in DAY_NAMES"
        :key="day"
        role="columnheader"
        :aria-label="day"
        class="text-center text-[11px] font-semibold text-(--text-muted) uppercase tracking-wider pb-2.5"
        aria-hidden="true"
      >
        {{ day }}
      </div>

      <!-- Blank offset cells before the 1st -->
      <div
        v-for="n in startOffset"
        :key="'pad-' + n"
        role="gridcell"
        aria-hidden="true"
        class="min-h-[62px]"
      />

      <!-- Day cells -->
      <div
        v-for="d in totalDays"
        :key="d"
        role="gridcell"
        :aria-label="cellAriaLabel(d)"
        :aria-selected="isSelected(d)"
        :aria-current="isToday(d) ? 'date' : undefined"
        :data-day="d"
        :tabindex="isSelected(d) ? 0 : -1"
        :style="cellStyle(d)"
        class="min-h-[62px] rounded-[10px] flex flex-col items-center justify-center cursor-pointer border-[1.5px] border-transparent bg-(--surface2) transition-all duration-200 select-none px-1 py-1.5 gap-0.5 focus:outline-none focus:ring-2 focus:ring-(--accent)"
        :class="{
          'opacity-50': isPast(d),
          'border-(--accent)': isSelected(d),
          'ring-2 ring-(--accent) scale-[1.08] z-[3]': dragOverDay === d,
          'hover:border-(--accent) hover:scale-[1.06] hover:z-[2]':
            !isPast(d) && dragOverDay !== d,
          'hover:border-(--border)': isPast(d),
        }"
        @click="selectDay(d, isPast(d))"
        @keydown="handleDayKeydown($event, d)"
        @dragover="onDayDragOver($event, d)"
        @dragleave="onDayDragLeave"
        @drop="onDayDrop($event, d)"
      >
        <span
          class="text-[15px] text-(--text)"
          :class="{ 'font-bold': isToday(d), 'font-medium': !isToday(d) }"
          >{{ d }}</span
        >

        <!-- Task indicator dots (up to 4) -->
        <span
          v-if="taskDotCount(d) > 0"
          class="flex gap-[3px]"
          aria-hidden="true"
        >
          <span
            v-for="i in taskDotCount(d)"
            :key="i"
            class="w-[5px] h-[5px] rounded-full bg-(--accent) opacity-90"
          />
        </span>
      </div>
    </div>
  </section>
</template>
