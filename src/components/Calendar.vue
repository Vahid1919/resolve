<template>
  <div class="calendar">
    <!-- Header: month/year navigation -->
    <div class="cal-header">
      <button class="nav-btn" @click="prevMonth">&#8249;</button>
      <span class="cal-title">{{ monthName }} {{ year }}</span>
      <button class="nav-btn" @click="nextMonth">&#8250;</button>
      <button class="today-btn" @click="jumpToToday">Today</button>
    </div>

    <!-- Day-of-week labels -->
    <div class="cal-grid">
      <div class="day-label" v-for="d in dayNames" :key="d">{{ d }}</div>

      <!-- Empty cells before the first day -->
      <div
        v-for="n in firstDayOfWeek"
        :key="'empty-' + n"
        class="day-cell empty"
      ></div>

      <!-- Actual day cells -->
      <div
        v-for="day in daysInMonth"
        :key="day"
        class="day-cell"
        :class="{
          today: isToday(day),
          selected: isSelected(day),
          past: isPast(day),
        }"
        :style="dayStyle(day)"
        @click="selectDay(day)"
      >
        <span class="day-number" :class="{ 'today-num': isToday(day) }">{{
          day
        }}</span>
        <span v-if="hasTodos(day)" class="dot-row">
          <span
            v-for="(dot, i) in dotCount(day)"
            :key="i"
            class="dot"
            :class="dot === 'done' ? 'dot-done' : 'dot-pending'"
          ></span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useTodos } from "../composables/useTodos.js";

const emit = defineEmits(["select"]);

const { getDateColor, todosByDate } = useTodos();

const today = new Date();
const currentYear = ref(today.getFullYear());
const currentMonth = ref(today.getMonth()); // 0-indexed

function todayKey() {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

const selectedDate = ref(todayKey());

onMounted(() => {
  emit("select", todayKey());
});

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthNames = [
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

const year = computed(() => currentYear.value);
const monthName = computed(() => monthNames[currentMonth.value]);

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate();
});

// 0 = Sunday
const firstDayOfWeek = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay();
});

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

function dateKey(day) {
  return `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isPast(day) {
  const cellDate = new Date(currentYear.value, currentMonth.value, day);
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return cellDate < todayMidnight;
}

function isToday(day) {
  return (
    day === today.getDate() &&
    currentMonth.value === today.getMonth() &&
    currentYear.value === today.getFullYear()
  );
}

function isSelected(day) {
  return selectedDate.value === dateKey(day);
}

function dotCount(day) {
  return (todosByDate[dateKey(day)] || [])
    .slice(0, 4)
    .map((t) => (t.done ? "done" : "pending"));
}

function hasTodos(day) {
  return dotCount(day).length > 0;
}

function dayStyle(day) {
  const key = dateKey(day);
  const color = getDateColor(key);
  if (color) {
    return { backgroundColor: color };
  }
  return {};
}

function selectDay(day) {
  const key = dateKey(day);
  selectedDate.value = key;
  emit("select", key, isPast(day));
}

function jumpToToday() {
  currentYear.value = today.getFullYear();
  currentMonth.value = today.getMonth();
  selectedDate.value = todayKey();
  emit("select", todayKey(), false);
}
</script>
