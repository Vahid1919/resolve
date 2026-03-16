<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import Calendar from "./components/Calendar.vue";
import TodoList from "./components/TodoList.vue";
import { useTodos } from "./composables/useTodos.js";

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const selectedDate = ref(todayKey);
const isPastDate = ref(false);
const isDark = ref(localStorage.getItem("trackr-theme") !== "light");

watch(
  isDark,
  (val) => {
    localStorage.setItem("trackr-theme", val ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", val ? "dark" : "light");
  },
  { immediate: true },
);

function onDateSelect(dateKey, isPast) {
  selectedDate.value = dateKey;
  isPastDate.value = !!isPast;
}

// ── Live clock ─────────────────────────────────────────
const clockTime = ref("");
let clockInterval = null;
function updateClock() {
  const now = new Date();
  clockTime.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
updateClock();

// ── Settings menu ─────────────────────────────────────
const { areas, addArea, removeArea, updateArea } = useTodos();

const settingsOpen = ref(false);
const newAreaName = ref("");
const AREA_COLORS = ["#ff2d78", "#00f5ff", "#aaff00"];
const newAreaColor = ref(AREA_COLORS[0]);
const settingsEl = ref(null);
const editingAreaId = ref(null);
const editAreaName = ref("");

function createArea() {
  if (!newAreaName.value.trim()) return;
  addArea(newAreaName.value, newAreaColor.value);
  newAreaName.value = "";
}

function startEditArea(a) {
  editingAreaId.value = a.id;
  editAreaName.value = a.name;
  nextTick(() => {
    const el = document.querySelector(".area-edit-input");
    if (el) {
      el.focus();
      el.select();
    }
  });
}

function saveEditArea(id) {
  if (editAreaName.value.trim()) {
    updateArea(id, { name: editAreaName.value });
  }
  editingAreaId.value = null;
  editAreaName.value = "";
}

function cancelEditArea() {
  editingAreaId.value = null;
  editAreaName.value = "";
}

function closeSettings(e) {
  if (settingsEl.value && !settingsEl.value.contains(e.target)) {
    settingsOpen.value = false;
  }
}
onMounted(() => {
  document.addEventListener("mousedown", closeSettings);
  clockInterval = setInterval(updateClock, 1000);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", closeSettings);
  clearInterval(clockInterval);
});
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <span class="app-name">Resolve</span>

      <span class="app-clock">{{ clockTime }}</span>

      <!-- Settings menu -->
      <div class="settings-wrap" ref="settingsEl">
        <button
          class="settings-btn"
          :class="{ 'settings-open': settingsOpen }"
          @click="settingsOpen = !settingsOpen"
          title="Settings"
        >
          <!-- Gear / cog icon -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            width="18"
            height="18"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>

        <Transition name="slide-down">
          <div v-if="settingsOpen" class="settings-panel">
            <!-- Theme toggle -->
            <div class="settings-row settings-theme-row">
              <span class="settings-label">Theme</span>
              <button
                class="theme-toggle"
                :class="isDark ? 'toggle-dark' : 'toggle-light'"
                @click="isDark = !isDark"
                :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
              >
                <svg
                  v-if="isDark"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  width="16"
                  height="16"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  width="16"
                  height="16"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                {{ isDark ? "Light" : "Dark" }}
              </button>
            </div>

            <div class="settings-divider"></div>

            <!-- Areas -->
            <div class="settings-section-title">Areas</div>
            <div v-if="areas.length" class="settings-areas-list">
              <div v-for="a in areas" :key="a.id" class="settings-area-row">
                <label
                  class="area-dot-lg area-dot-edit"
                  :style="{ background: a.color }"
                  title="Change color"
                >
                  <input
                    type="color"
                    :value="a.color"
                    @input="updateArea(a.id, { color: $event.target.value })"
                  />
                </label>
                <template v-if="editingAreaId === a.id">
                  <input
                    class="area-edit-input"
                    v-model="editAreaName"
                    maxlength="30"
                    @keydown.enter="saveEditArea(a.id)"
                    @keydown.esc="cancelEditArea"
                    @blur="saveEditArea(a.id)"
                  />
                </template>
                <template v-else>
                  <span class="settings-area-name">{{ a.name }}</span>
                  <button
                    class="area-action-btn"
                    @click="startEditArea(a)"
                    title="Edit area name"
                  >
                    <svg viewBox="0 0 14 14" fill="none">
                      <path
                        d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    class="area-action-btn area-action-del"
                    @click="removeArea(a.id)"
                    title="Delete area"
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
                </template>
              </div>
            </div>
            <p v-else class="settings-empty">No areas yet.</p>

            <!-- Add area form -->
            <div class="settings-add-area">
              <div class="area-swatches">
                <button
                  v-for="c in AREA_COLORS"
                  :key="c"
                  class="area-swatch"
                  :class="{ 'swatch-active': newAreaColor === c }"
                  :style="{ background: c }"
                  @click="newAreaColor = c"
                ></button>
                <label
                  class="area-swatch area-color-wheel"
                  :class="{
                    'swatch-active': !AREA_COLORS.includes(newAreaColor),
                  }"
                  :style="
                    !AREA_COLORS.includes(newAreaColor)
                      ? { background: newAreaColor, backgroundImage: 'none' }
                      : {}
                  "
                  title="Custom color"
                >
                  <input type="color" v-model="newAreaColor" />
                </label>
              </div>
              <div class="settings-input-row">
                <input
                  class="add-input"
                  v-model="newAreaName"
                  placeholder="New area..."
                  maxlength="30"
                  @keydown.enter="createArea"
                />
                <button class="add-btn" @click="createArea">Add</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </header>

    <main class="app-main">
      <Calendar @select="onDateSelect" />
      <TodoList
        :dateKey="selectedDate"
        :readOnly="isPastDate"
        @select-day="onDateSelect"
      />
    </main>
  </div>
</template>

<style scoped></style>
