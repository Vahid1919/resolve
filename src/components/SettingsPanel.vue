<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useStore } from "../store/index.js";

const props = defineProps({
  isDark: { type: Boolean, required: true },
});

const emit = defineEmits(["toggleTheme", "close"]);

const { areas, addArea, removeArea, updateArea } = useStore();

// ── Area color presets ────────────────────────────────────────────────────────
const PRESET_COLORS = ["#ff2d78", "#00f5ff", "#aaff00"];
const newAreaName = ref("");
const newAreaColor = ref(PRESET_COLORS[0]);

function createArea() {
  if (!newAreaName.value.trim()) return;
  addArea(newAreaName.value, newAreaColor.value);
  newAreaName.value = "";
}

// ── Inline area name editing ──────────────────────────────────────────────────
const editingAreaId = ref(null);
const editAreaName = ref("");

function startEditArea(area) {
  editingAreaId.value = area.id;
  editAreaName.value = area.name;
  nextTick(() => document.querySelector(".area-edit-input")?.focus());
}

function saveEditArea(id) {
  if (editAreaName.value.trim()) updateArea(id, { name: editAreaName.value });
  editingAreaId.value = null;
  editAreaName.value = "";
}

function cancelEditArea() {
  editingAreaId.value = null;
  editAreaName.value = "";
}
</script>

<template>
  <!--
    Settings panel — appears below the gear button in the header.
    Keyboard: Escape closes (handled by parent via @keydown).
  -->
  <section
    role="dialog"
    aria-modal="false"
    aria-label="Settings"
    class="absolute top-[calc(100%+8px)] right-0 w-64 rounded-xl border border-(--border) bg-(--surface) p-3 z-50 flex flex-col gap-3"
    style="box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45)"
  >
    <!-- ── Theme toggle ──────────────────────────────── -->
    <div class="flex items-center justify-between">
      <span
        class="text-[0.78rem] font-bold uppercase tracking-wider text-(--text-sub)"
      >
        Theme
      </span>
      <button
        class="flex items-center gap-1.5 text-[0.85rem] px-3 py-1 rounded-lg border border-(--border) bg-(--surface2) text-(--text) transition-colors hover:bg-(--surface3) hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        :aria-pressed="isDark"
        @click="$emit('toggleTheme')"
      >
        <!-- Sun icon (dark mode) -->
        <svg
          v-if="isDark"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          width="14"
          height="14"
          aria-hidden="true"
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
        <!-- Moon icon (light mode) -->
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        {{ isDark ? "Light" : "Dark" }}
      </button>
    </div>

    <hr class="border-(--border)" aria-hidden="true" />

    <!-- ── Areas ─────────────────────────────────────── -->
    <div>
      <h2
        class="text-[0.78rem] font-bold uppercase tracking-wider text-(--text-sub) mb-2"
      >
        Areas
      </h2>

      <ul
        v-if="areas.length"
        class="flex flex-col gap-1 mb-3"
        role="list"
        aria-label="Saved areas"
      >
        <li
          v-for="a in areas"
          :key="a.id"
          class="flex items-center gap-2 px-1 py-0.5 rounded group"
        >
          <!-- Color-picker dot -->
          <label
            class="area-color-input w-2.5 h-2.5 rounded-full shrink-0 relative inline-block transition-transform cursor-pointer hover:scale-125"
            :style="{ background: a.color }"
            :title="`Change color for ${a.name}`"
            :aria-label="`Change color for ${a.name}`"
          >
            <input
              type="color"
              :value="a.color"
              @input="updateArea(a.id, { color: $event.target.value })"
            />
          </label>

          <!-- Editing state -->
          <template v-if="editingAreaId === a.id">
            <input
              class="area-edit-input flex-1 text-[0.9rem] px-2 py-0.5 rounded-md border border-(--accent) bg-(--surface2) text-(--text) outline-none font-[inherit]"
              v-model="editAreaName"
              maxlength="30"
              :aria-label="`Rename area, currently ${a.name}`"
              @keydown.enter="saveEditArea(a.id)"
              @keydown.esc="cancelEditArea"
              @blur="saveEditArea(a.id)"
            />
          </template>

          <!-- Display state -->
          <template v-else>
            <span class="flex-1 text-[0.9rem] text-(--text)">{{
              a.name
            }}</span>

            <!-- Edit button -->
            <button
              class="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 text-(--text-muted) hover:text-(--accent) hover:bg-(--accent-soft) transition-all focus:outline-none focus:ring-1 focus:ring-(--accent)"
              @click="startEditArea(a)"
              :aria-label="`Rename area ${a.name}`"
            >
              <svg
                viewBox="0 0 14 14"
                fill="none"
                width="12"
                height="12"
                aria-hidden="true"
              >
                <path
                  d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            <!-- Delete button -->
            <button
              class="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 text-(--text-muted) hover:text-(--danger) hover:bg-(--danger-soft) transition-all focus:outline-none focus:ring-1 focus:ring-(--danger)"
              @click="removeArea(a.id)"
              :aria-label="`Delete area ${a.name}`"
            >
              <svg
                viewBox="0 0 14 14"
                fill="none"
                width="12"
                height="12"
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
          </template>
        </li>
      </ul>

      <p v-else class="text-[0.85rem] text-(--text-muted) mb-3">
        No areas yet.
      </p>

      <!-- Add area form ──────────────────────────────── -->
      <div class="flex flex-col gap-2">
        <!-- Color swatches -->
        <div
          class="flex gap-1 flex-wrap"
          role="group"
          aria-label="Choose area colour"
        >
          <button
            v-for="c in PRESET_COLORS"
            :key="c"
            class="w-4 h-4 rounded-full border-2 border-transparent transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-(--accent)"
            :class="{ 'border-(--text) scale-110': newAreaColor === c }"
            :style="{ background: c }"
            :aria-label="`Colour ${c}`"
            :aria-pressed="newAreaColor === c"
            @click="newAreaColor = c"
          />

          <!-- Custom color wheel -->
          <label
            class="color-wheel-swatch w-4 h-4 rounded-full border-2 border-transparent transition-transform hover:scale-110"
            :class="{
              'border-(--text) scale-110':
                !PRESET_COLORS.includes(newAreaColor),
            }"
            :style="
              !PRESET_COLORS.includes(newAreaColor)
                ? { background: newAreaColor, backgroundImage: 'none' }
                : {}
            "
            title="Custom colour"
            aria-label="Open custom colour picker"
          >
            <input type="color" v-model="newAreaColor" />
          </label>
        </div>

        <!-- Name input + add button -->
        <div class="flex gap-1.5">
          <input
            class="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--surface2) text-(--text) text-sm placeholder:text-(--text-sub) outline-none focus:border-(--accent) focus:bg-(--surface3) transition-colors font-[inherit]"
            v-model="newAreaName"
            placeholder="New area…"
            maxlength="30"
            aria-label="New area name"
            @keydown.enter="createArea"
          />
          <button
            class="px-4 py-2 rounded-lg bg-(--accent) text-(--bg) text-sm font-semibold transition-all hover:bg-(--accent-dim) hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-(--accent) focus:ring-offset-1"
            @click="createArea"
            aria-label="Add new area"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
