/**
 * api.js — the single place that talks to the backend over HTTP.
 *
 * The store calls these functions; they don't touch app state themselves. Every
 * request automatically carries the user's JWT as an "Authorization: Bearer
 * <token>" header so the server knows who's asking.
 *
 * Where do requests go?
 *   • In development, VITE_API_URL is unset, so paths are relative ("/api/...")
 *     and Vite's dev server proxies them to the backend on localhost:3000.
 *   • In production, VITE_API_URL is set to the deployed server's URL.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'resolve_token' // the localStorage key the JWT is stored under

// Tiny helpers to read/write/clear the saved token. auth.js uses these too.
export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

/**
 * The one function every API call below goes through. It:
 *   • attaches the auth token,
 *   • JSON-encodes the body (for POST/PATCH/DELETE that send data),
 *   • and turns a 401 (not logged in / token expired) into an automatic logout.
 * Returns the parsed JSON response, or throws on any non-OK status.
 */
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
        // Token is missing, expired, or invalidated (e.g. server secret rotated).
        // Clear it and reload so the user is sent back to the login screen.
        clearToken()
        window.location.reload()
        const err = new Error('unauthenticated')
        err.status = 401
        throw err
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
    return res.json()
}

// The public API surface: one method per backend endpoint, grouped by resource.
// Each just calls req() with the right method/path/body.
export const api = {
    me: () => req('GET', '/me'),
    sync: () => req('GET', '/sync'),
    logout: () => Promise.resolve(), // JWT logout is handled client-side (clearToken)

    // Tasks
    createTask: (dateKey, text, areaId, parentId = null) => req('POST', '/tasks', { dateKey, text, areaId, parentId }),
    deleteTask: (id) => req('DELETE', `/tasks/${id}`),
    deleteCompleted: (id) => req('DELETE', `/tasks/${id}/completed`),
    completeTask: (id) => req('POST', `/tasks/${id}/complete`),
    uncompleteTask: (id) => req('POST', `/tasks/${id}/uncomplete`),
    setTaskArea: (id, areaId) => req('PATCH', `/tasks/${id}/area`, { areaId }),
    updateTaskText: (id, text) => req('PATCH', `/tasks/${id}/text`, { text }),
    moveTaskDate: (id, toDateKey) => req('PATCH', `/tasks/${id}/date`, { toDateKey }),
    reorderTask: (id, sortOrder) => req('PATCH', `/tasks/${id}/order`, { sortOrder }),
    setTaskParent: (id, parentId) => req('PATCH', `/tasks/${id}/parent`, { parentId }),

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
