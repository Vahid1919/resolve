<template>
  <div class="panel" :class="{ 'panel-readonly': readOnly }">
    <div v-if="!dateKey" class="panel-empty">
      <p class="panel-empty-text">Select a day to plan your tasks</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="panel-head">
        <div>
          <p class="panel-weekday" v-if="viewMode === 'day'">{{ weekday }}</p>
          <h2 class="panel-date" v-if="viewMode === 'day'">{{ dayMonth }}</h2>
          <h2 class="panel-date" v-else>{{ weekRangeLabel }}</h2>
        </div>
        <div class="panel-head-actions">
          <span v-if="readOnly" class="readonly-badge">Past</span>
          <div class="view-toggle">
            <button
              class="view-btn"
              :class="{ 'view-btn-active': viewMode === 'day' }"
              @click="viewMode = 'day'"
            >
              Day
            </button>
            <button
              class="view-btn"
              :class="{ 'view-btn-active': viewMode === 'week' }"
              @click="viewMode = 'week'"
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <!-- Area filter bar -->
      <div v-if="areas.length" class="area-bar">
        <div class="area-filters">
          <button
            class="area-pill"
            :class="{ 'area-pill-active': activeAreaFilter === null }"
            @click="activeAreaFilter = null"
          >
            All
          </button>
          <button
            v-for="a in areas"
            :key="a.id"
            class="area-pill"
            :class="{ 'area-pill-active': activeAreaFilter === a.id }"
            :style="
              activeAreaFilter === a.id
                ? { background: a.color, borderColor: a.color, color: '#fff' }
                : {
                    background: 'transparent',
                    borderColor: a.color,
                    color: '#fff',
                  }
            "
            @click="activeAreaFilter = activeAreaFilter === a.id ? null : a.id"
          >
            {{ a.name }}
          </button>
        </div>
      </div>

      <!-- ── WEEK VIEW ─────────────────────────────────── -->
      <template v-if="viewMode === 'week'">
        <div class="week-list">
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="week-day"
            :class="{
              'week-today': day.isToday,
              'week-past': day.isPast,
              'week-selected': day.isSelected,
            }"
          >
            <div class="week-day-head" @click="goToDay(day)">
              <span class="week-day-name">{{ day.dayName }}</span>
              <span class="week-day-date"
                >{{ day.monthShort }} {{ day.dateNum }}</span
              >
              <span class="week-day-score" v-if="day.tasksTotal"
                >{{ day.tasksDone }}/{{ day.tasksTotal }}</span
              >
              <span class="week-habit-pips" v-if="day.habits.length">
                <span
                  v-for="h in day.habits.slice(0, 6)"
                  :key="h.id"
                  class="week-pip"
                  :class="{ 'pip-done': isHabitDone(day.key, h.id) }"
                  :style="h.areaId ? { background: areaColor(h.areaId) } : {}"
                ></span>
              </span>
            </div>
            <div
              class="week-task-list"
              v-if="day.tasks.length || day.doneTasks.length"
            >
              <div
                v-for="t in day.doneTasks"
                :key="t.id"
                class="week-task-row week-task-done"
              >
                <span
                  class="week-task-pip"
                  :style="t.areaId ? { background: areaColor(t.areaId) } : {}"
                ></span>
                <span class="week-task-text">{{ t.text }}</span>
              </div>
              <div v-for="t in day.tasks" :key="t.id" class="week-task-row">
                <span
                  class="week-task-pip"
                  :style="t.areaId ? { background: areaColor(t.areaId) } : {}"
                ></span>
                <span class="week-task-text">{{ t.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ── DAY VIEW ──────────────────────────────────── -->
      <template v-else>
        <!-- ── PAST / READ-ONLY VIEW ─────────────────────── -->
        <template v-if="readOnly">
          <div class="section">
            <div class="section-head">
              <span class="section-title">Tasks</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in completedTasks"
                :key="task.id"
                class="task-row"
              >
                <span class="status-badge badge-done">done</span>
                <span class="item-text item-text-done">{{ task.text }}</span>
                <span
                  v-if="task.areaId"
                  class="area-chip"
                  :style="{
                    borderColor: areaColor(task.areaId),
                    color: areaColor(task.areaId),
                  }"
                  >{{ areaName(task.areaId) }}</span
                >
              </div>
              <div v-for="task in activeTasks" :key="task.id" class="task-row">
                <span class="status-badge badge-pending">pending</span>
                <span class="item-text">{{ task.text }}</span>
                <span
                  v-if="task.areaId"
                  class="area-chip"
                  :style="{
                    borderColor: areaColor(task.areaId),
                    color: areaColor(task.areaId),
                  }"
                  >{{ areaName(task.areaId) }}</span
                >
              </div>
            </div>
            <p
              v-if="!completedTasks.length && !activeTasks.length"
              class="empty-hint"
            >
              No tasks were added.
            </p>
          </div>

          <div class="section">
            <div class="section-head">
              <span class="section-title">Habits</span>
            </div>
            <div class="task-list">
              <div v-for="habit in dateHabits" :key="habit.id" class="task-row">
                <span
                  class="status-badge"
                  :class="
                    isHabitDone(dateKey, habit.id)
                      ? 'badge-done'
                      : 'badge-pending'
                  "
                >
                  {{ isHabitDone(dateKey, habit.id) ? "done" : "pending" }}
                </span>
                <span
                  class="item-text"
                  :class="{ 'item-text-done': isHabitDone(dateKey, habit.id) }"
                  >{{ habit.text }}</span
                >
                <span class="cadence-badge">{{
                  habitCadenceLabel(habit)
                }}</span>
                <span
                  v-if="habit.areaId"
                  class="area-chip"
                  :style="{
                    borderColor: areaColor(habit.areaId),
                    color: areaColor(habit.areaId),
                  }"
                  >{{ areaName(habit.areaId) }}</span
                >
              </div>
            </div>
            <p v-if="!dateHabits.length" class="empty-hint">
              No habits were scheduled.
            </p>
          </div>
        </template>

        <!-- ── ACTIVE VIEW ───────────────────────────────── -->
        <template v-else>
          <!-- TASKS -->
          <div class="section">
            <div class="section-head">
              <span class="section-title">Tasks</span>
              <button
                class="add-toggle-btn"
                :class="{ 'add-toggle-open': addingType === 'task' }"
                @click="toggleAddForm('task')"
              >
                <svg viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <Transition name="slide-down">
              <div v-if="addingType === 'task'" class="add-form">
                <div v-if="areas.length" class="area-picker">
                  <button
                    class="area-pick-btn"
                    :class="{ 'area-pick-none': newAreaId === null }"
                    @click="newAreaId = null"
                  >
                    None
                  </button>
                  <button
                    v-for="a in areas"
                    :key="a.id"
                    class="area-pick-btn"
                    :class="{ 'area-pick-active': newAreaId === a.id }"
                    :style="{
                      background: a.color,
                      borderColor: a.color,
                      color: '#fff',
                    }"
                    @click="newAreaId = a.id"
                  >
                    {{ a.name }}
                  </button>
                </div>
                <div class="suggestions">
                  <button
                    v-for="s in taskSuggestions"
                    :key="s"
                    class="suggestion-pill"
                    @click="quickAdd('task', s)"
                  >
                    {{ s }}
                  </button>
                </div>
                <div class="add-row">
                  <input
                    ref="taskInputEl"
                    class="add-input"
                    v-model="newText"
                    placeholder="Custom task..."
                    maxlength="120"
                    @keydown.enter="confirmAdd"
                    @keydown.esc="cancelAdd"
                  />
                  <button class="add-btn" @click="confirmAdd">Add</button>
                </div>
              </div>
            </Transition>

            <TransitionGroup name="task-item" tag="div" class="task-list">
              <div
                v-for="task in activeTasks"
                :key="task.id"
                class="task-row"
                @contextmenu.prevent="openTagMenu('task', task.id, $event)"
              >
                <button class="check-btn" @click="completeTask(task.id)">
                  <svg viewBox="0 0 12 10" fill="none">
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <span
                  v-if="task.areaId"
                  class="area-dot"
                  :style="{ background: areaColor(task.areaId) }"
                ></span>
                <span class="item-text">{{ task.text }}</span>
                <button class="del-btn" @click="removeTodo(dateKey, task.id)">
                  <svg viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 2l10 10M12 2L2 12"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </div>
            </TransitionGroup>
            <div v-if="completedTasks.length" class="task-list task-list-done">
              <div
                v-for="item in completedTasks"
                :key="item.id"
                class="task-row task-row-done"
              >
                <button
                  class="check-btn check-checked"
                  @click="unarchiveTodo(dateKey, item.id)"
                  title="Mark as not done"
                >
                  <svg viewBox="0 0 12 10" fill="none">
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <span
                  v-if="item.areaId"
                  class="area-dot"
                  :style="{ background: areaColor(item.areaId) }"
                ></span>
                <span class="item-text item-text-done">{{ item.text }}</span>
                <button
                  class="del-btn"
                  @click="removeCompleted(dateKey, item.id)"
                >
                  <svg viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 2l10 10M12 2L2 12"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <p
              v-if="!activeTasks.length && !completedTasks.length"
              class="empty-hint"
            >
              No tasks yet.
            </p>
          </div>

          <!-- HABITS -->
          <div class="section">
            <div class="section-head">
              <span class="section-title">Habits</span>
              <button
                class="add-toggle-btn"
                :class="{ 'add-toggle-open': addingType === 'habit' }"
                @click="toggleAddForm('habit')"
              >
                <svg viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>

            <Transition name="slide-down">
              <div v-if="addingType === 'habit'" class="add-form">
                <div class="cadence-row">
                  <button
                    v-for="c in CADENCES"
                    :key="c.value"
                    class="cadence-opt"
                    :class="{ 'cadence-opt-active': newCadence === c.value }"
                    @click="newCadence = c.value"
                  >
                    {{ c.label }}
                  </button>
                </div>
                <div v-if="newCadence === 'custom'" class="day-picker">
                  <button
                    v-for="(d, i) in DAY_LABELS"
                    :key="i"
                    class="day-btn"
                    :class="{ 'day-btn-active': customDays.includes(i) }"
                    @click="toggleCustomDay(i)"
                  >
                    {{ d }}
                  </button>
                </div>
                <div v-if="areas.length" class="area-picker">
                  <button
                    class="area-pick-btn"
                    :class="{ 'area-pick-none': newAreaId === null }"
                    @click="newAreaId = null"
                  >
                    None
                  </button>
                  <button
                    v-for="a in areas"
                    :key="a.id"
                    class="area-pick-btn"
                    :class="{ 'area-pick-active': newAreaId === a.id }"
                    :style="{
                      background: a.color,
                      borderColor: a.color,
                      color: '#fff',
                    }"
                    @click="newAreaId = a.id"
                  >
                    {{ a.name }}
                  </button>
                </div>
                <div class="suggestions">
                  <button
                    v-for="s in habitSuggestions"
                    :key="s"
                    class="suggestion-pill"
                    @click="quickAdd('habit', s)"
                  >
                    {{ s }}
                  </button>
                </div>
                <div class="add-row">
                  <input
                    ref="habitInputEl"
                    class="add-input"
                    v-model="newText"
                    placeholder="Custom habit..."
                    maxlength="120"
                    @keydown.enter="confirmAdd"
                    @keydown.esc="cancelAdd"
                  />
                  <button class="add-btn" @click="confirmAdd">Add</button>
                </div>
              </div>
            </Transition>

            <TransitionGroup name="task-item" tag="div" class="task-list">
              <div
                v-for="habit in dateHabits"
                :key="habit.id"
                class="task-row"
                :class="{
                  'check-checked-row': isHabitDone(dateKey, habit.id),
                }"
                @contextmenu.prevent="openTagMenu('habit', habit.id, $event)"
              >
                <button
                  class="check-btn"
                  :class="{ 'check-checked': isHabitDone(dateKey, habit.id) }"
                  @click="toggleHabit(habit.id)"
                >
                  <svg viewBox="0 0 12 10" fill="none">
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <div class="item-col">
                  <span
                    v-if="habit.areaId"
                    class="area-dot"
                    :style="{ background: areaColor(habit.areaId) }"
                  ></span>
                  <span
                    class="item-text"
                    :class="{
                      'item-text-done': isHabitDone(dateKey, habit.id),
                    }"
                    >{{ habit.text }}</span
                  >
                </div>
                <span class="cadence-badge">{{
                  habitCadenceLabel(habit)
                }}</span>
                <div class="del-wrap">
                  <button
                    class="del-btn"
                    @click.stop="openHabitDeleteMenu(habit.id)"
                  >
                    <svg viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2 2l10 10M12 2L2 12"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <Transition name="fade">
                    <div
                      v-if="habitDeleteMenuId === habit.id"
                      class="del-popover"
                      @click.stop
                    >
                      <button
                        class="del-pop-btn"
                        @click="deleteHabitThisDay(habit.id)"
                      >
                        This day only
                      </button>
                      <button
                        class="del-pop-btn del-pop-danger"
                        @click="deleteHabitFuture(habit.id)"
                      >
                        This day &amp; all future
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>
            </TransitionGroup>
            <p v-if="!dateHabits.length" class="empty-hint">No habits yet.</p>
          </div>
        </template>
      </template>
    </template>
  </div>

  <!-- Toast notification -->
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </Transition>
  </Teleport>

  <!-- Right-click area context menu -->
  <Teleport to="body">
    <div
      v-if="tagMenu"
      class="ctx-menu"
      :style="{ left: tagMenu.x + 'px', top: tagMenu.y + 'px' }"
      @click.stop
    >
      <button class="ctx-menu-item ctx-menu-none" @click="applyTag(null)">
        No area
      </button>
      <button
        v-for="a in areas"
        :key="a.id"
        class="ctx-menu-item"
        @click="applyTag(a.id)"
      >
        <span class="ctx-area-dot" :style="{ background: a.color }"></span>
        {{ a.name }}
      </button>
    </div>
  </Teleport>
</template>
<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useTodos } from "../composables/useTodos.js";

const props = defineProps({
  dateKey: { type: String, default: null },
  readOnly: { type: Boolean, default: false },
});

const emit = defineEmits(["selectDay"]);

const {
  getTodos,
  addTodo,
  removeTodo,
  archiveTodo,
  getCompleted,
  removeCompleted,
  unarchiveTodo,
  addHabitDef,
  addHabitException,
  removeHabitDefFromDate,
  getHabitsForDate,
  isHabitDone,
  completeHabit,
  uncompleteHabit,
  setTodoArea,
  setHabitArea,
  areas,
} = useTodos();

// ── View mode ──────────────────────────────────
const viewMode = ref("day");

function completeTask(id) {
  archiveTodo(props.dateKey, id);
}

// ── Habit toggle ───────────────────────────────────────
function toggleHabit(id) {
  if (!props.dateKey) return;
  if (isHabitDone(props.dateKey, id)) uncompleteHabit(props.dateKey, id);
  else completeHabit(props.dateKey, id);
}

// ── Habit delete popover ───────────────────────────────
const habitDeleteMenuId = ref(null);

function openHabitDeleteMenu(id) {
  habitDeleteMenuId.value = habitDeleteMenuId.value === id ? null : id;
}
function deleteHabitThisDay(id) {
  addHabitException(props.dateKey, id);
  habitDeleteMenuId.value = null;
}
function deleteHabitFuture(id) {
  removeHabitDefFromDate(id, props.dateKey);
  habitDeleteMenuId.value = null;
}

// ── Inline area tag menu ──────────────────────────────
const tagMenu = ref(null); // { type: 'task'|'habit', id }

function openTagMenu(type, id, event) {
  if (tagMenu.value?.type === type && tagMenu.value?.id === id) {
    tagMenu.value = null;
    return;
  }
  // Clamp so menu doesn't go off-screen
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
    setTodoArea(props.dateKey, tagMenu.value.id, areaId);
  else setHabitArea(tagMenu.value.id, areaId);
  tagMenu.value = null;
}

function closeAllMenus() {
  habitDeleteMenuId.value = null;
  tagMenu.value = null;
}
onMounted(() => document.addEventListener("click", closeAllMenus));
onUnmounted(() => document.removeEventListener("click", closeAllMenus));

// ── Area filter ───────────────────────────────────────
const activeAreaFilter = ref(null);

function areaColor(id) {
  return areas.find((a) => a.id === id)?.color || "transparent";
}
function areaName(id) {
  return areas.find((a) => a.id === id)?.name || "";
}

// ── Lists ──────────────────────────────────────────────
const activeTasks = computed(() => {
  const all = props.dateKey ? getTodos(props.dateKey) : [];
  return activeAreaFilter.value === null
    ? all
    : all.filter((t) => t.areaId === activeAreaFilter.value);
});
const completedTasks = computed(() =>
  props.dateKey ? getCompleted(props.dateKey) : [],
);
const dateHabits = computed(() => {
  const all = props.dateKey ? getHabitsForDate(props.dateKey) : [];
  return activeAreaFilter.value === null
    ? all
    : all.filter((h) => h.areaId === activeAreaFilter.value);
});

function habitCadenceLabel(habit) {
  if (habit.cadence === "daily") return "daily";
  if (habit.cadence === "weekly") return "weekly";
  if (habit.cadence === "custom" && habit.customDays?.length) {
    const n = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return habit.customDays.map((d) => n[d]).join(" ");
  }
  return habit.cadence || "daily";
}

// ── Toast notification ────────────────────────────────
const toastMsg = ref(null);
let toastTimer = null;

watch(
  () =>
    props.dateKey
      ? getTodos(props.dateKey).length + getHabitsForDate(props.dateKey).length
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

// ── Week view ────────────────────────────────────────────
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

function _dk(dt) {
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
    const dk = _dk(dt);
    const isPast = dt < today;
    const isToday = dt.getTime() === today.getTime();
    const allTasks = getTodos(dk);
    const doneTasks = getCompleted(dk);
    const allHabits = getHabitsForDate(dk);
    const filt = activeAreaFilter.value;
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
      isToday,
      isPast,
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
  emit("selectDay", day.key, day.isPast);
  viewMode.value = "day";
}

// ── Cadence & day picker ───────────────────────────────
const CADENCES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const newCadence = ref("daily");
const customDays = ref([]);

function toggleCustomDay(i) {
  const idx = customDays.value.indexOf(i);
  if (idx === -1) customDays.value.push(i);
  else customDays.value.splice(idx, 1);
}

// ── Add form ───────────────────────────────────────────
const TASK_POOL = [
  "Review emails",
  "Go for a walk",
  "Read for 20 min",
  "Plan tomorrow",
  "Call a friend",
  "Clean workspace",
  "Write in journal",
  "Grocery run",
  "Study for 1 hour",
  "Drink 2L water",
  "Stretch for 10 min",
  "Backup files",
  "Respond to messages",
  "Organize desktop",
  "Review notes",
];
const HABIT_POOL = [
  "Morning meditation",
  "Evening walk",
  "Cold shower",
  "No phone first hour",
  "Sleep by 11pm",
  "Gratitude list",
  "Read 10 pages",
  "10 min stretch",
  "Cook at home",
  "No social media",
  "7+ hours sleep",
  "Vitamins",
  "No sugar",
  "10k steps",
  "Journaling",
];

const addingType = ref(null);
const newText = ref("");
const newAreaId = ref(null);
const taskSuggestions = ref([]);
const habitSuggestions = ref([]);
const taskInputEl = ref(null);
const habitInputEl = ref(null);

function _sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function toggleAddForm(type) {
  if (addingType.value === type) {
    cancelAdd();
    return;
  }
  addingType.value = type;
  newText.value = "";
  newAreaId.value = null;
  taskSuggestions.value = _sample(TASK_POOL, 4);
  habitSuggestions.value = _sample(HABIT_POOL, 4);
  nextTick(() => {
    if (type === "task") taskInputEl.value?.focus();
    else habitInputEl.value?.focus();
  });
}

function cancelAdd() {
  addingType.value = null;
  newText.value = "";
  newCadence.value = "daily";
  customDays.value = [];
  newAreaId.value = null;
}

function confirmAdd() {
  if (!newText.value.trim() || !addingType.value || !props.dateKey) return;
  if (addingType.value === "task")
    addTodo(props.dateKey, newText.value, newAreaId.value);
  else
    addHabitDef(
      newText.value,
      newCadence.value,
      customDays.value,
      props.dateKey,
      newAreaId.value,
    );
  cancelAdd();
}

function quickAdd(type, text) {
  if (!props.dateKey) return;
  if (type === "task") addTodo(props.dateKey, text, newAreaId.value);
  else
    addHabitDef(
      text,
      newCadence.value,
      customDays.value,
      props.dateKey,
      newAreaId.value,
    );
  cancelAdd();
}

// ── Date display ───────────────────────────────────────
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
</script>
