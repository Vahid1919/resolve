<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import Calendar from "./components/Calendar.vue";
import TodoList from "./components/TodoList.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import AuthScreen from "./components/AuthScreen.vue";
import { useClock } from "./composables/useClock.js";
import { useTheme } from "./composables/useTheme.js";
import { user, authLoading, loadUser, logout } from "./store/auth.js";
import { syncAll } from "./store/index.js";

const { time: clockTime } = useClock();
const { isDark, toggleTheme } = useTheme();

// ── Date selection ────────────────────────────────────────────────────────────
const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const selectedDate = ref(todayKey);
const isPastDate = ref(false);

function onDateSelect(dateKey, isPast) {
  selectedDate.value = dateKey;
  isPastDate.value = !!isPast;
}

// ── Settings panel ────────────────────────────────────────────────────────────
const settingsOpen = ref(false);
const settingsEl = ref(null);

// ── Profile dropdown ─────────────────────────────────────────────────────────
const profileOpen = ref(false);
const profileEl = ref(null);

async function handleLogout() {
  profileOpen.value = false;
  await logout();
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function closeOnOutsideClick(e) {
  if (settingsEl.value && !settingsEl.value.contains(e.target)) {
    settingsOpen.value = false;
  }
  if (profileEl.value && !profileEl.value.contains(e.target)) {
    profileOpen.value = false;
  }
}

function closeOnEscape(e) {
  if (e.key === "Escape") settingsOpen.value = false;
}

onMounted(async () => {
  document.addEventListener("mousedown", closeOnOutsideClick);
  document.addEventListener("keydown", closeOnEscape);

  await loadUser()
  if (user.value) await syncAll().catch(() => {})
});
onUnmounted(() => {
  document.removeEventListener("mousedown", closeOnOutsideClick);
  document.removeEventListener("keydown", closeOnEscape);
});
</script>

<template>
  <!-- Auth gate -->
  <AuthScreen v-if="!authLoading && !user" />

  <!-- Loading splash while session check is in-flight -->
  <div
    v-else-if="authLoading"
    class="min-h-screen flex items-center justify-center bg-(--bg)"
    aria-label="Loading"
  >
    <span
      class="text-xl font-bold tracking-[0.18em] uppercase text-(--accent) animate-flicker app-name-glow"
    >
      Resolve
    </span>
  </div>

  <!-- Main app (authenticated) -->
  <div v-else class="min-h-screen flex flex-col bg-(--bg) text-(--text)">
    <!-- ── App header ───────────────────────────────────────────────────────── -->
    <header
      role="banner"
      class="sticky top-0 z-10 flex items-center gap-3 px-10 py-5 border-b border-(--border) bg-(--surface) animate-slide-up"
      style="box-shadow: var(--shadow)"
    >
      <!-- App name -->
      <span
        class="text-xl font-bold tracking-[0.18em] uppercase text-(--accent) animate-flicker app-name-glow"
        aria-label="Resolve"
        >Resolve</span
      >

      <!-- Live clock -->
      <span
        class="ml-auto text-xs font-semibold tracking-widest uppercase text-(--accent) animate-flicker opacity-75"
        aria-live="polite"
        aria-label="Current time"
        >{{ clockTime }}</span
      >

      <!-- Profile button + dropdown -->
      <div class="relative" ref="profileEl">
        <button
          @click="profileOpen = !profileOpen"
          class="flex items-center gap-2 px-2 py-1 rounded-xl border border-(--border)
                 bg-(--surface2) hover:bg-(--surface3) hover:border-(--accent)
                 transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent)"
          :aria-expanded="profileOpen"
          aria-label="Account menu"
        >
          <img
            v-if="user?.avatar"
            :src="user.avatar"
            :alt="user.name"
            class="w-7 h-7 rounded-full object-cover shrink-0"
            referrerpolicy="no-referrer"
          />
          <span v-else class="w-7 h-7 rounded-full bg-(--accent) flex items-center justify-center text-xs font-bold text-(--bg) shrink-0">
            {{ user?.name?.[0]?.toUpperCase() }}
          </span>
          <span class="text-xs font-semibold text-(--text) max-w-28 truncate hidden sm:block">
            {{ user?.name }}
          </span>
        </button>

        <Transition name="slide-down">
          <div
            v-if="profileOpen"
            class="absolute right-0 top-full mt-2 w-52 rounded-xl border border-(--border)
                   bg-(--surface) z-20 overflow-hidden"
            style="box-shadow: var(--shadow)"
          >
            <!-- User info -->
            <div class="flex items-center gap-3 px-4 py-3 border-b border-(--border)">
              <img
                v-if="user?.avatar"
                :src="user.avatar"
                :alt="user.name"
                class="w-9 h-9 rounded-full object-cover shrink-0"
                referrerpolicy="no-referrer"
              />
              <span v-else class="w-9 h-9 rounded-full bg-(--accent) flex items-center justify-center text-sm font-bold text-(--bg) shrink-0">
                {{ user?.name?.[0]?.toUpperCase() }}
              </span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-(--text) truncate">{{ user?.name }}</p>
                <p class="text-xs text-(--text-muted) truncate">{{ user?.email }}</p>
              </div>
            </div>
            <!-- Sign out -->
            <button
              @click="handleLogout"
              class="w-full flex items-center gap-2 px-4 py-3 text-sm text-(--text)
                     hover:bg-(--surface2) transition-colors text-left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </Transition>
      </div>

      <!-- Settings button + dropdown panel -->
      <div class="relative" ref="settingsEl">
        <button
          class="w-11 h-9 flex items-center justify-center rounded-[10px] border border-(--border) bg-(--surface2) text-(--text) cursor-pointer transition-colors hover:bg-(--surface3) hover:border-(--accent) focus:outline-none focus:ring-2 focus:ring-(--accent)"
          :class="{ 'bg-(--surface3) border-(--accent)': settingsOpen }"
          @click="toggleSettings"
          :aria-expanded="settingsOpen"
          :aria-label="settingsOpen ? 'Close settings' : 'Open settings'"
          aria-controls="settings-panel"
        >
          <!-- Gear icon -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            />
          </svg>
        </button>

        <Transition name="slide-down">
          <SettingsPanel
            v-if="settingsOpen"
            id="settings-panel"
            :isDark="isDark"
            @toggle-theme="toggleTheme"
            @close="settingsOpen = false"
          />
        </Transition>
      </div>
    </header>

    <!-- ── Main layout ──────────────────────────────────────────────────────── -->
    <main
      role="main"
      class="flex flex-1 gap-7 p-8 items-start max-w-350 w-full mx-auto max-md:flex-col max-md:p-5"
    >
      <Calendar @select="onDateSelect" />
      <TodoList :dateKey="selectedDate" :readOnly="isPastDate" />
    </main>
  </div>
</template>
