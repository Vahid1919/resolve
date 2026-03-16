/**
 * useTheme() — persisted dark/light mode toggle.
 *
 * Reads the user's saved preference from localStorage and applies it
 * immediately via a data-theme attribute on <html>.
 */

import { ref, watch } from 'vue'

const THEME_KEY = 'resolve-theme'

export function useTheme() {
    const isDark = ref(localStorage.getItem(THEME_KEY) !== 'light')

    watch(isDark, val => {
        localStorage.setItem(THEME_KEY, val ? 'dark' : 'light')
        document.documentElement.setAttribute('data-theme', val ? 'dark' : 'light')
    }, { immediate: true })

    function toggleTheme() {
        isDark.value = !isDark.value
    }

    return { isDark, toggleTheme }
}
