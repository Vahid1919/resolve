/**
 * Thin fetch wrapper for the Resolve API.
 * Auth uses a JWT stored in localStorage, sent as Authorization: Bearer <token>.
 * In dev, VITE_API_URL is unset → relative URLs → Vite proxy → localhost:3000.
 * In production, VITE_API_URL is set to the Railway server URL.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'resolve_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

async function req(method, path, body) {
    const opts = { method, headers: {} }
    const token = getToken()
    if (token) opts.headers['Authorization'] = `Bearer ${token}`
    if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json'
        opts.body = JSON.stringify(body)
    }
    const res = await fetch(`${API_BASE}/api${path}`, opts)
    if (res.status === 401) {
        const err = new Error('unauthenticated')
        err.status = 401
        throw err
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
    return res.json()
}

export const api = {
    me: () => req('GET', '/me'),
    sync: () => req('GET', '/sync'),
    logout: () => Promise.resolve(), // JWT logout is handled client-side (clearToken)

    // Tasks
    createTask: (dateKey, text, areaId) => req('POST', '/tasks', { dateKey, text, areaId }),
    deleteTask: (id) => req('DELETE', `/tasks/${id}`),
    deleteCompleted: (id) => req('DELETE', `/tasks/${id}/completed`),
    completeTask: (id) => req('POST', `/tasks/${id}/complete`),
    uncompleteTask: (id) => req('POST', `/tasks/${id}/uncomplete`),
    setTaskArea: (id, areaId) => req('PATCH', `/tasks/${id}/area`, { areaId }),

    // Habits
    createHabit: (data) => req('POST', '/habits', data),
    deleteHabit: (id, fromDate) => req('DELETE', `/habits/${id}`, { fromDate }),
    completeHabit: (id, dateKey) => req('POST', `/habits/${id}/complete`, { dateKey }),
    uncompleteHabit: (id, dateKey) => req('POST', `/habits/${id}/uncomplete`, { dateKey }),
    skipHabit: (id, dateKey) => req('POST', `/habits/${id}/skip`, { dateKey }),
    setHabitArea: (id, areaId) => req('PATCH', `/habits/${id}/area`, { areaId }),

    // Areas
    createArea: (name, color) => req('POST', '/areas', { name, color }),
    updateArea: (id, name, color) => req('PATCH', `/areas/${id}`, { name, color }),
    deleteArea: (id) => req('DELETE', `/areas/${id}`),
}
