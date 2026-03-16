<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import TaskSection from "./TaskSection.vue";
import HabitSection from "./HabitSection.vue";
import { useStore } from "../store/index.js";

const props = defineProps({
  dateKey: { type: String, default: null },
  readOnly: { type: Boolean, default: false },
});

const emit = defineEmits(["select-day"]);

const {
  areas,
  areaColor,
  areaName,
  getTasks,
  getCompleted,
  getHabitsForDate,
  setTaskArea,
  setHabitArea,
  isHabitDone,
} = useStore();

// ── View mode ─────────────────────────────────────────────────────────────────
const viewMode = ref("day");

// ── Area filter ───────────────────────────────────────────────────────────────
const activeAreaFilter = ref(null);

// ── Date display ──────────────────────────────────────────────────────────────
const weekday = computed(() => {
  if (!props.dateKey) return "";
  const [y, m, d] = props.dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
});

const dayMonth = computed(() => {
  if (!props.dateKey) return "";
  const [y, m, d] = props.dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
});

// ── Week view data ────────────────────────────────────────────────────────────
const MON_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function makeDateKey(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const weekDays = computed(() => {
  if (!props.dateKey) return [];
  const [y, m, d] = props.dateKey.split("-").map(Number);
  const sel = new Date(y, m - 1, d);
  const dow = sel.getDay();
  const mon = new Date(sel);
  mon.setDate(sel.getDate() - (dow === 0 ? 6 : dow - 1));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    const dk = makeDateKey(dt);
    const filt = activeAreaFilter.value;

    const allTasks = getTasks(dk) || [];
    const doneTasks = getCompleted(dk) || [];
    const allHabits = getHabitsForDate(dk) || [];

    const tasks =
      filt === null ? allTasks : allTasks.filter((t) => t.areaId === filt);
    const done =
      filt === null ? doneTasks : doneTasks.filter((t) => t.areaId === filt);
    const habits =
      filt === null ? allHabits : allHabits.filter((h) => h.areaId === filt);

    return {
      key: dk,
      dayName: DAY_SHORT[dt.getDay()],
      dateNum: dt.getDate(),
      monthShort: MON_SHORT[dt.getMonth()],
      isToday: dt.getTime() === today.getTime(),
      isPast: dt < today,
      isSelected: dk === props.dateKey,
      tasks,
      doneTasks: done,
      habits,
      tasksDone: done.length,
      tasksTotal: tasks.length + done.length,
    };
  });
});

const weekRangeLabel = computed(() => {
  if (!weekDays.value.length) return "";
  const f = weekDays.value[0];
  const l = weekDays.value[6];
  return `${f.monthShort} ${f.dateNum} – ${l.monthShort} ${l.dateNum}`;
});

function goToDay(day) {
  emit("select-day", day.key, day.isPast);
  viewMode.value = "day";
}

// ── Toast notification ────────────────────────────────────────────────────────
const toastMsg = ref(null);
let toastTimer = null;

watch(
  () =>
    props.dateKey
      ? (getTasks(props.dateKey)?.length || 0) +
        (getHabitsForDate(props.dateKey)?.length || 0)
      : 0,
  (total) => {
    if (total > 5 && !props.readOnly) {
      clearTimeout(toastTimer);
      toastMsg.value = `You have ${total} items today — consider trimming your list.`;
      toastTimer = setTimeout(() => {
        toastMsg.value = null;
      }, 4000);
    }
  },
);

// ── Right-click area context menu ─────────────────────────────────────────────
const tagMenu = ref(null);

function openTagMenu(type, id, event) {
  if (tagMenu.value?.type === type && tagMenu.value?.id === id) {
    tagMenu.value = null;
    return;
  }
  const x = Math.min(event.clientX, window.innerWidth - 160);
  const y = Math.min(
    event.clientY,
    window.innerHeight - 40 * (areas.length + 2),
  );
  tagMenu.value = { type, id, x, y };
}

function applyTag(areaId) {
  if (!tagMenu.value) return;
  if (tagMenu.value.type === "task")
    setTaskArea(props.dateKey, tagMenu.value.id, areaId);
  else setHabitArea(tagMenu.value.id, areaId);
  tagMenu.value = null;
}

function closeAllMenus() {
  tagMenu.value = null;
}

onMounted(() => document.addEventListener("click", closeAllMenus));
onUnmounted(() => document.removeEventListener("click", closeAllMenus));
</script>

<template>
  <!-- Empty state (no date selected) -->
  <div
    v-if="!dateKey"
    class="flex-1 flex items-center justify-center text-(--text-muted) text-sm"
  >
    Select a day to plan your tasks
  </div>

  <div
    v-else
    class="flex-1 bg-(--surface) border border-(--border) rounded-2xl flex flex-col min-h-0 max-h-[calc(100vh-120px)] overflow-hidden animate-slide-up"
    :class="{ 'opacity-85': readOnly }"
    style="box-shadow: var(--shadow)"
  >
    <!-- ── Panel header ──────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-7 pt-6 pb-4 shrink-0">
      <div>
        <p
          v-if="viewMode === 'day'"
          class="text-[11px] font-semibold uppercase tracking-[0.15em] text-(--text-sub)"
        >
          {{ weekday }}
        </p>
        <h2 class="text-[22px] font-bold tracking-tight text-(--text)">
          {{ viewMode === "day" ? dayMonth : weekRangeLabel }}
        </h2>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="readOnly"
          class="text-[11px] font-semibold uppercase tracking-wider text-(--text-muted) px-2 py-1 rounded border border-(--border)"
          aria-label="Past day — read only"
          >Past</span
        >
        <!-- Day / Week toggle -->
        <div
          class="flex border border-(--border) rounded-[10px]"
          role="group"
          aria-label="View mode"
        >
          <button
            class="px-4 py-2 text-xs font-semibold transition-colors rounded-l-[9px]"
            :class="{
              'bg-(--surface3) text-(--text)': viewMode === 'day',
              'bg-transparent text-(--text-muted) hover:text-(--text)':
                viewMode !== 'day',
            }"
            @click="viewMode = 'day'"
            :aria-pressed="viewMode === 'day'"
            aria-label="Day view"
          >
            Day
          </button>
          <button
            class="px-4 py-2 text-xs font-semibold transition-colors border-l border-(--border) rounded-r-[9px]"
            :class="{
              'bg-(--surface3) text-(--text)': viewMode === 'week',
              'bg-transparent text-(--text-muted) hover:text-(--text)':
                viewMode !== 'week',
            }"
            @click="viewMode = 'week'"
            :aria-pressed="viewMode === 'week'"
            aria-label="Week view"
          >
            Week
          </button>
        </div>
      </div>
    </div>

    <!-- ── Area filter bar ───────────────────────────────────────────────────── -->
    <div
      v-if="areas.length"
      class="px-7 pb-3 flex gap-1.5 flex-wrap shrink-0"
      role="group"
      aria-label="Filter by area"
    >
      <button
        class="px-3 py-1 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--accent)"
        :class="{
          'bg-(--text) text-(--bg)': activeAreaFilter === null,
          'bg-(--surface3) text-(--text-muted) hover:text-(--text)':
            activeAreaFilter !== null,
        }"
        @click="activeAreaFilter = null"
        :aria-pressed="activeAreaFilter === null"
      >
        All
      </button>
      <button
        v-for="a in areas"
        :key="a.id"
        class="px-3 py-1 rounded-full text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:-outline-offset-2"
        :style="{
          background: a.color,
          color: '#fff',
          outlineColor: a.color,
          opacity:
            activeAreaFilter === null || activeAreaFilter === a.id ? 1 : 0.45,
        }"
        :class="{ 'hover:opacity-80': activeAreaFilter !== a.id }"
        @click="activeAreaFilter = activeAreaFilter === a.id ? null : a.id"
        :aria-pressed="activeAreaFilter === a.id"
      >
        {{ a.name }}
      </button>
    </div>

    <!-- ── Scrollable content ────────────────────────────────────────────────── -->
    <div
      class="flex-1 overflow-y-auto thin-scroll px-7 pt-1 pb-7 flex flex-col gap-8"
    >
      <!-- WEEK VIEW -->
      <template v-if="viewMode === 'week'">
        <ul class="flex flex-col gap-2" role="list" aria-label="Week summary">
          <li
            v-for="day in weekDays"
            :key="day.key"
            class="border border-(--border) rounded-xl overflow-hidden"
            :class="{
              'border-(--accent)': day.isSelected,
              'opacity-60': day.isPast,
            }"
            role="listitem"
          >
            <!-- Day header row -->
            <button
              class="w-full flex items-center gap-3 px-4 py-3 bg-(--surface2) hover:bg-(--surface3) transition-colors text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-(--accent)"
              @click="goToDay(day)"
              :aria-label="`Go to ${day.dayName} ${day.monthShort} ${day.dateNum}`"
            >
              <span
                class="text-[13px] font-bold w-8 shrink-0"
                :class="
                  day.isToday
                    ? 'text-(--accent)'
                    : 'text-(--text-muted)'
                "
                >{{ day.dayName }}</span
              >
              <span class="text-[13px] text-(--text-muted)"
                >{{ day.monthShort }} {{ day.dateNum }}</span
              >
              <span
                v-if="day.tasksTotal"
                class="ml-auto text-[12px] text-(--text-sub)"
              >
                {{ day.tasksDone }}/{{ day.tasksTotal }}
              </span>
              <!-- Habit pips -->
              <span
                v-if="day.habits.length"
                class="flex gap-1 ml-1"
                aria-hidden="true"
              >
                <span
                  v-for="h in day.habits.slice(0, 6)"
                  :key="h.id"
                  class="w-2 h-2 rounded-full"
                  :class="
                    isHabitDone(day.key, h.id) ? 'opacity-100' : 'opacity-30'
                  "
                  :style="
                    h.areaId
                      ? { background: areaColor(h.areaId) }
                      : { background: 'var(--text-muted)' }
                  "
                />
              </span>
            </button>
            <!-- Tasks for this day -->
            <div
              v-if="day.tasks.length || day.doneTasks.length"
              class="px-4 py-2 flex flex-col gap-1"
            >
              <div
                v-for="t in day.doneTasks"
                :key="t.id"
                class="flex items-center gap-1.5"
              >
                <span
                  class="w-1.75 h-1.75 rounded-full shrink-0"
                  :style="
                    t.areaId
                      ? { background: areaColor(t.areaId) }
                      : { background: 'var(--border)' }
                  "
                />
                <span
                  class="text-[12px] text-(--text-muted) line-through"
                  >{{ t.text }}</span
                >
              </div>
              <div
                v-for="t in day.tasks"
                :key="t.id"
                class="flex items-center gap-1.5"
              >
                <span
                  class="w-1.75 h-1.75 rounded-full shrink-0"
                  :style="
                    t.areaId
                      ? { background: areaColor(t.areaId) }
                      : { background: 'var(--border)' }
                  "
                />
                <span class="text-[12px] text-(--text)">{{ t.text }}</span>
              </div>
            </div>
          </li>
        </ul>
      </template>

      <!-- DAY VIEW -->
      <template v-else>
        <TaskSection
          :dateKey="dateKey"
          :readOnly="readOnly"
          :activeAreaFilter="activeAreaFilter"
          @tag-menu="openTagMenu"
        />
        <HabitSection
          :dateKey="dateKey"
          :readOnly="readOnly"
          :activeAreaFilter="activeAreaFilter"
          @tag-menu="openTagMenu"
        />
      </template>
    </div>
  </div>

  <!-- ── Toast notification ─────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toastMsg"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-(--surface) border border-(--border) text-(--text) text-[13px] px-5 py-3 rounded-xl"
        style="box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)"
        role="status"
        aria-live="polite"
      >
        {{ toastMsg }}
      </div>
    </Transition>
  </Teleport>

  <!-- ── Right-click area tag menu ─────────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="tagMenu"
      class="fixed z-100 min-w-37.5 rounded-xl border border-(--border) bg-(--surface) p-1 flex flex-col gap-0.5"
      :style="{
        left: tagMenu.x + 'px',
        top: tagMenu.y + 'px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }"
      role="menu"
      aria-label="Assign area"
      @click.stop
    >
      <button
        class="w-full text-left px-3 py-2 rounded-lg text-[13px] text-(--text-muted) transition-colors hover:bg-(--surface2) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
        @click="applyTag(null)"
        role="menuitem"
      >
        No area
      </button>
      <button
        v-for="a in areas"
        :key="a.id"
        class="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-(--text) transition-colors hover:bg-(--surface2) focus:outline-none focus:ring-1 focus:ring-(--accent)"
        @click="applyTag(a.id)"
        role="menuitem"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :style="{ background: a.color }"
          aria-hidden="true"
        />
        {{ a.name }}
      </button>
    </div>
  </Teleport>
</template>
