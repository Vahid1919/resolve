<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Calendar      from './components/Calendar.vue'
import TodoList      from './components/TodoList.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useClock }  from './composables/useClock.js'
import { useTheme }  from './composables/useTheme.js'

const { time: clockTime }     = useClock()
const { isDark, toggleTheme } = useTheme()

// ── Date selection ────────────────────────────────────────────────────────────
const today    = new Date()
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const selectedDate = ref(todayKey)
const isPastDate   = ref(false)

function onDateSelect(dateKey, isPast) {
  selectedDate.value = dateKey
  isPastDate.value   = !!isPast
}

// ── Settings panel ────────────────────────────────────────────────────────────
const settingsOpen = ref(false)
const settingsEl   = ref(null)

function toggleSettings() { settingsOpen.value = !settingsOpen.value }

function closeOnOutsideClick(e) {
  if (settingsEl.value && !settingsEl.value.contains(e.target)) {
    settingsOpen.value = false
  }
}

function closeOnEscape(e) {
  if (e.key === 'Escape') settingsOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', closeOnOutsideClick)
  document.addEventListener('keydown',   closeOnEscape)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', closeOnOutsideClick)
  document.removeEventListener('keydown',   closeOnEscape)
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-(--bg) text-(--text)">

    <!-- ── App header ───────────────────────────────────────────────────────── -->
    <header
      role="banner"
      class="sticky top-0 z-10 flex items-center gap-3 px-10 py-5
             border-b border-(--border) bg-(--surface) animate-slide-up"
      style="box-shadow: var(--shadow)"
    >
      <!-- App name -->
      <span
        class="text-xl font-bold tracking-[0.18em] uppercase text-(--accent)
               animate-flicker app-name-glow"
        aria-label="Resolve"
      >Resolve</span>

      <!-- Live clock -->
      <span
        class="ml-auto text-xs font-semibold tracking-widest uppercase
               text-(--accent) animate-flicker opacity-75"
        aria-live="polite"
        aria-label="Current time"
      >{{ clockTime }}</span>

      <!-- Settings button + dropdown panel -->
      <div class="relative" ref="settingsEl">
        <button
          class="w-11 h-9 flex items-center justify-center rounded-[10px]
                 border border-(--border) bg-(--surface2) text-(--text)
                 cursor-pointer transition-colors
                 hover:bg-(--surface3) hover:border-(--accent)
                 focus:outline-none focus:ring-2 focus:ring-(--accent)"
          :class="{ 'bg-(--surface3) border-(--accent)': settingsOpen }"
          @click="toggleSettings"
          :aria-expanded="settingsOpen"
          :aria-label="settingsOpen ? 'Close settings' : 'Open settings'"
          aria-controls="settings-panel"
        >
          <!-- Gear icon -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
               width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
      class="flex flex-1 gap-7 p-8 items-start
             max-w-[1400px] w-full mx-auto
             max-md:flex-col max-md:p-5"
    >
      <Calendar @select="onDateSelect" />
      <TodoList
        :dateKey="selectedDate"
        :readOnly="isPastDate"
      />
    </main>

  </div>
</template>
