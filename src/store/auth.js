import { ref } from 'vue'
import { api } from '../api.js'

export const user = ref(null)   // { id, email, name, avatar } | null
export const authLoading = ref(true)   // true while initial /api/me is in-flight

export async function loadUser() {
    try {
        user.value = await api.me()
    } catch {
        user.value = null
    } finally {
        authLoading.value = false
    }
}

export async function logout() {
    await api.logout()
    user.value = null
}

export function signInWithGoogle() {
    const base = import.meta.env.VITE_API_URL ?? ''
    window.location.href = `${base}/auth/google`
}
