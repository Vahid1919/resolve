/**
 * composables.js — small reusable bits of reactive logic.
 *
 * In Vue, a "composable" is just a function whose name starts with `use` that
 * bundles up some reactive state and behavior so any component can reuse it.
 * This file has two tiny ones: a live clock and a dark/light theme toggle.
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'

// ──────────────────────────────────────────────────────────────────────────────
//  useClock() — a reactive time string that updates every second.
// ──────────────────────────────────────────────────────────────────────────────
export function useClock() {
    const time = ref('')

    // Format the current time like "01:09:42 PM".
    function update() {
        time.value = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        })
    }

    let interval = null

    // Start ticking when the component appears…
    onMounted(() => {
        update()
        interval = setInterval(update, 1000)
    })
    // …and stop when it goes away (so we don't leak a timer).
    onUnmounted(() => clearInterval(interval))

    return { time }
}

// ──────────────────────────────────────────────────────────────────────────────
//  useTheme() — dark/light mode, remembered between visits.
// ──────────────────────────────────────────────────────────────────────────────
const THEME_KEY = 'resolve-theme' // localStorage key

export function useTheme() {
    // Default to dark; only "light" (saved previously) makes it light.
    const isDark = ref(localStorage.getItem(THEME_KEY) !== 'light')

    // Whenever isDark changes, (a) remember the choice and (b) set a
    // `data-theme` attribute on <html>. The CSS in style.css swaps every color
    // based on that attribute. `immediate: true` runs this once on load too.
    watch(isDark, val => {
        localStorage.setItem(THEME_KEY, val ? 'dark' : 'light')
        document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light')
    }, { immediate: true })

    function toggleTheme() {
        isDark.value = !isDark.value
    }

    return { isDark, toggleTheme }
}
