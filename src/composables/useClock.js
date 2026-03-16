/**
 * useClock() — reactive live clock, updated every second.
 *
 * Starts the interval on mount and clears it on unmount so it is
 * safe to use in any component.
 */

import { ref, onMounted, onUnmounted } from 'vue'

export function useClock() {
    const time = ref('')

    function update() {
        time.value = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        })
    }

    let interval = null

    onMounted(() => {
        update()
        interval = setInterval(update, 1000)
    })

    onUnmounted(() => {
        clearInterval(interval)
    })

    return { time }
}
