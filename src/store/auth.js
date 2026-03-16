import { ref } from 'vue'
import { getToken, setToken, clearToken } from '../api.js'

export const user        = ref(null)   // { id, email, name, avatar } | null
export const authLoading = ref(true)   // true while resolving token on app load

function decodeJwt(token) {
    try {
        return JSON.parse(atob(token.split('.')[1]))
    } catch {
        return null
    }
}

export function loadUser() {
    // Pick up token from URL after OAuth redirect
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
        setToken(urlToken)
        window.history.replaceState({}, '', window.location.pathname)
    }

    const token = getToken()
    if (token) {
        const payload = decodeJwt(token)
        if (payload && payload.exp * 1000 > Date.now()) {
            user.value = { id: payload.id, email: payload.email, name: payload.name, avatar: payload.avatar }
        } else {
            clearToken() // expired
        }
    }
    authLoading.value = false
}

export function logout() {
    clearToken()
    user.value = null
}

export function signInWithGoogle() {
    const base = import.meta.env.VITE_API_URL ?? ''
    window.location.href = `${base}/auth/google`
}
