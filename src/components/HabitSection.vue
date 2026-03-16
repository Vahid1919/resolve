<script setup>
import { ref, computed, nextTick } from "vue";
import { useStore } from "../store/index.js";

const props = defineProps({
  dateKey: { type: String, required: true },
  readOnly: { type: Boolean, default: false },
  activeAreaFilter: { type: Number, default: null },
});

const emit = defineEmits(["tag-menu"]);

const {
  getHabitsForDate,
  isHabitDone,
  completeHabit,
  uncompleteHabit,
  skipHabitOnDate,
  removeHabitFromDate,
  addHabit,
  areas,
  areaColor,
  areaName,
} = useStore();

// ── Filtered habits ───────────────────────────────────────────────────────────
const dateHabits = computed(() => {
  const all = getHabitsForDate(props.dateKey) || [];
  return props.activeAreaFilter === null
    ? all
    : all.filter((h) => h.areaId === props.activeAreaFilter);
});

function toggleHabit(id) {
  if (isHabitDone(props.dateKey, id)) uncompleteHabit(props.dateKey, id);
  else completeHabit(props.dateKey, id);
}

// ── Habit delete popover ──────────────────────────────────────────────────────
const deleteMenuId = ref(null);

function openDeleteMenu(id) {
  deleteMenuId.value = deleteMenuId.value === id ? null : id;
}
function deleteThisDay(id) {
  skipHabitOnDate(props.dateKey, id);
  deleteMenuId.value = null;
}
function deleteFromHere(id) {
  removeHabitFromDate(id, props.dateKey);
  deleteMenuId.value = null;
}

// ── Cadence labels ────────────────────────────────────────────────────────────
const CADENCES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cadenceLabel(habit) {
  if (habit.cadence === "daily") return "daily";
  if (habit.cadence === "weekly") return "weekly";
  if (habit.cadence === "custom" && habit.customDays?.length) {
    const abbr = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return habit.customDays.map((d) => abbr[d]).join(" ");
  }
  return habit.cadence || "daily";
}

// ── Add form ──────────────────────────────────────────────────────────────────
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

function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const showForm = ref(false);
const newText = ref("");
const newCadence = ref("daily");
const customDays = ref([]);
const newAreaId = ref(null);
const suggestions = ref([]);
const inputEl = ref(null);

function openForm() {
  showForm.value = true;
  newText.value = "";
  newCadence.value = "daily";
  customDays.value = [];
  newAreaId.value = null;
  suggestions.value = sample(HABIT_POOL, 4);
  nextTick(() => inputEl.value?.focus());
}
function closeForm() {
  showForm.value = false;
  newText.value = "";
  customDays.value = [];
  newAreaId.value = null;
}
function toggleCustomDay(i) {
  const idx = customDays.value.indexOf(i);
  if (idx === -1) customDays.value.push(i);
  else customDays.value.splice(idx, 1);
}
function confirmAdd() {
  if (!newText.value.trim()) return;
  addHabit(
    newText.value,
    newCadence.value,
    customDays.value,
    props.dateKey,
    newAreaId.value,
  );
  closeForm();
}
function quickAdd(text) {
  addHabit(
    text,
    newCadence.value,
    customDays.value,
    props.dateKey,
    newAreaId.value,
  );
  closeForm();
}
</script>

<template>
  <section aria-label="Habits">
    <!-- Section header -->
    <div class="flex items-center justify-between mb-3">
      <h3
        class="text-[13px] font-bold uppercase tracking-wider text-(--text-muted)"
      >
        Habits
      </h3>
      <button
        v-if="!readOnly"
        class="w-7 h-7 flex items-center justify-center rounded-[8px] border border-(--border) bg-(--surface2) text-(--text-muted) cursor-pointer transition-all hover:bg-(--surface3) hover:border-(--accent) hover:text-(--text)"
        :class="{
          'bg-(--surface3) border-(--accent) text-(--text) rotate-45':
            showForm,
        }"
        @click="showForm ? closeForm() : openForm()"
        :aria-expanded="showForm"
        aria-label="Add habit"
      >
        <svg
          viewBox="0 0 14 14"
          fill="none"
          width="12"
          height="12"
          aria-hidden="true"
        >
          <path
            d="M7 1v12M1 7h12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <!-- Add form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="mb-3 flex flex-col gap-2">
        <!-- Cadence selector -->
        <div class="flex gap-1" role="group" aria-label="Habit cadence">
          <button
            v-for="c in CADENCES"
            :key="c.value"
            class="px-3 py-1 rounded-full text-xs border border-(--border) text-(--text-muted) transition-colors hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :class="{
              'border-(--accent) text-(--text) bg-(--accent-soft)':
                newCadence === c.value,
            }"
            @click="newCadence = c.value"
            :aria-pressed="newCadence === c.value"
          >
            {{ c.label }}
          </button>
        </div>
        <!-- Custom day picker -->
        <div
          v-if="newCadence === 'custom'"
          class="flex gap-1"
          role="group"
          aria-label="Custom days"
        >
          <button
            v-for="(d, i) in DAY_LABELS"
            :key="i"
            class="w-8 h-8 flex items-center justify-center rounded-full text-[11px] font-semibold border border-(--border) text-(--text-muted) transition-colors hover:border-(--accent) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :class="{
              'border-(--accent) bg-(--accent-soft) text-(--text)':
                customDays.includes(i),
            }"
            @click="toggleCustomDay(i)"
            :aria-pressed="customDays.includes(i)"
            :aria-label="d"
          >
            {{ d }}
          </button>
        </div>
        <!-- Area picker -->
        <div
          v-if="areas.length"
          class="flex flex-wrap gap-1"
          role="group"
          aria-label="Select area for habit"
        >
          <button
            class="px-2 py-0.5 rounded-full text-xs border border-(--border) text-(--text-muted) transition-colors hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :class="{
              'border-(--accent) text-(--text)': newAreaId === null,
            }"
            @click="newAreaId = null"
            :aria-pressed="newAreaId === null"
          >
            None
          </button>
          <button
            v-for="a in areas"
            :key="a.id"
            class="px-2 py-0.5 rounded-full text-xs border font-medium transition-opacity focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :style="{
              background: a.color,
              borderColor: a.color,
              color: '#fff',
              opacity: newAreaId === a.id ? 1 : 0.5,
            }"
            @click="newAreaId = a.id"
            :aria-pressed="newAreaId === a.id"
          >
            {{ a.name }}
          </button>
        </div>
        <!-- Suggestions -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="s in suggestions"
            :key="s"
            class="px-2 py-0.5 rounded-full text-xs border border-(--border) text-(--text-muted) cursor-pointer transition-colors hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            @click="quickAdd(s)"
          >
            {{ s }}
          </button>
        </div>
        <!-- Text input -->
        <div class="flex gap-1.5">
          <input
            ref="inputEl"
            class="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--surface2) text-(--text) text-sm placeholder-(--text-sub) outline-none focus:border-(--accent) focus:bg-(--surface3) transition-colors"
            v-model="newText"
            placeholder="Custom habit..."
            maxlength="120"
            aria-label="Habit description"
            @keydown.enter="confirmAdd"
            @keydown.esc="closeForm"
          />
          <button
            class="px-4 py-2 rounded-lg bg-(--accent) text-(--bg) text-sm font-semibold cursor-pointer transition-all hover:bg-(--accent-dim) hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-(--accent)"
            @click="confirmAdd"
          >
            Add
          </button>
        </div>
      </div>
    </Transition>

    <!-- Habit list -->
    <TransitionGroup
      name="task-item"
      tag="ul"
      class="flex flex-col gap-0.5"
      role="list"
      aria-label="Habits list"
    >
      <li
        v-for="habit in dateHabits"
        :key="habit.id"
        class="group flex items-center gap-2 px-2 py-2 rounded-[10px] transition-colors"
        :class="{
          'hover:bg-(--surface3)': !isHabitDone(dateKey, habit.id),
          'bg-(--surface2) opacity-70': isHabitDone(dateKey, habit.id),
        }"
        role="listitem"
        @contextmenu.prevent="$emit('tag-menu', 'habit', habit.id, $event)"
      >
        <button
          v-if="!readOnly"
          class="w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-(--accent)"
          :class="{
            'border-(--accent) bg-(--accent-soft) text-(--accent)':
              isHabitDone(dateKey, habit.id),
            'border-(--border) bg-(--surface2) text-transparent hover:border-(--accent) hover:text-(--text-muted)':
              !isHabitDone(dateKey, habit.id),
          }"
          @click="toggleHabit(habit.id)"
          :aria-label="
            (isHabitDone(dateKey, habit.id)
              ? 'Mark not done: '
              : 'Mark done: ') + habit.text
          "
          :aria-pressed="isHabitDone(dateKey, habit.id)"
        >
          <svg
            viewBox="0 0 12 10"
            fill="none"
            width="9"
            height="9"
            aria-hidden="true"
          >
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
          v-else
          class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
          :class="{
            'border-(--accent) text-(--accent)': isHabitDone(
              dateKey,
              habit.id,
            ),
            'border-(--border) text-(--text-muted)': !isHabitDone(
              dateKey,
              habit.id,
            ),
          }"
          >{{ isHabitDone(dateKey, habit.id) ? "done" : "pending" }}</span
        >

        <span
          v-if="habit.areaId"
          class="w-1.75 h-1.75 rounded-full shrink-0"
          :style="{ background: areaColor(habit.areaId) }"
        />
        <span
          class="flex-1 text-[14px] leading-snug"
          :class="{
            'text-(--text-muted) line-through': isHabitDone(
              dateKey,
              habit.id,
            ),
            'text-(--text)': !isHabitDone(dateKey, habit.id),
          }"
          >{{ habit.text }}</span
        >

        <!-- Cadence badge -->
        <span
          class="text-[10px] font-medium text-(--text-sub) shrink-0 px-1.5 py-0.5 rounded border border-(--border)"
        >
          {{ cadenceLabel(habit) }}
        </span>

        <!-- Delete popover (active mode only) -->
        <div class="relative shrink-0" v-if="!readOnly">
          <button
            class="w-5 h-5 flex items-center justify-center rounded-md shrink-0 text-(--text-sub) opacity-0 group-hover:opacity-100 hover:text-(--danger) hover:bg-(--danger-soft) transition-all focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-(--danger)"
            @click.stop="openDeleteMenu(habit.id)"
            :aria-label="'Delete habit: ' + habit.text"
            :aria-expanded="deleteMenuId === habit.id"
          >
            <svg
              viewBox="0 0 14 14"
              fill="none"
              width="11"
              height="11"
              aria-hidden="true"
            >
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
              v-if="deleteMenuId === habit.id"
              class="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-(--border) bg-(--surface) p-1 flex flex-col gap-0.5"
              style="box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)"
              role="menu"
              :aria-label="'Delete options for ' + habit.text"
              @click.stop
            >
              <button
                class="w-full text-left px-3 py-2 rounded-lg text-[13px] text-(--text-muted) transition-colors hover:bg-(--surface2) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
                @click="deleteThisDay(habit.id)"
                role="menuitem"
              >
                This day only
              </button>
              <button
                class="w-full text-left px-3 py-2 rounded-lg text-[13px] text-(--danger) transition-colors hover:bg-(--danger-soft) focus:outline-none focus:ring-1 focus:ring-(--danger)"
                @click="deleteFromHere(habit.id)"
                role="menuitem"
              >
                This day &amp; all future
              </button>
            </div>
          </Transition>
        </div>
      </li>
    </TransitionGroup>

    <p
      v-if="!dateHabits.length"
      class="text-[13px] text-(--text-sub) px-2 py-1"
    >
      No habits yet.
    </p>
  </section>
</template>
