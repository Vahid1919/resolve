/**
 * auth.js — who is signed in, on the frontend side.
 *
 * Resolve signs users in with Google. The actual login happens on the server
 * (see server/index.js). Here on the frontend we only deal with the result: a
 * JWT (JSON Web Token) — a signed string that proves who the user is.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  The login round-trip
 * ──────────────────────────────────────────────────────────────────────────────
 *   1. User clicks "Sign in with Google" → signInWithGoogle() sends them to the
 *      server's /auth/google page.
 *   2. The server talks to Google, then redirects back to our app with the token
 *      in the URL, e.g.  https://app/?token=eyJhbGc...
 *   3. loadUser() (called on startup) grabs that token from the URL, saves it in
 *      localStorage, and decodes it to learn the user's name/email/avatar.
 *   4. From then on, api.js attaches the token to every request so the server
 *      knows who's asking.
 *
 * A JWT has three parts separated by dots: header.payload.signature. We only
 * read the middle "payload" part (the user info). We do NOT verify the
 * signature here — only the server can do that with its secret key. The worst a
 * tampered token can do is get rejected by the server with a 401.
 */

import { ref } from 'vue'
import { getToken, setToken, clearToken } from './api.js'

// The currently signed-in user, or null if logged out.  { id, email, name, avatar }
export const user = ref(null)
// True while we're still figuring out if there's a valid token (avoids flashing
// the login screen for a split second on every page load).
export const authLoading = ref(true)

/** Decode the payload (middle part) of a JWT. Returns null if it's malformed. */
function decodeJwt(token) {
    try {
        // atob() base64-decodes the payload; then it's JSON.
        return JSON.parse(atob(token.split('.')[1]))
    } catch {
        return null
    }
}

/**
 * Work out who (if anyone) is signed in. Called once when the app starts.
 * Sets `user` and then flips `authLoading` off.
 */
export function loadUser() {
    // Step 1: if we just came back from Google, the token is in the URL.
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
        setToken(urlToken)
        // Remove ?token=... from the address bar so it isn't bookmarked/shared.
        window.history.replaceState({}, '', window.location.pathname)
    }

    // Step 2: read whatever token we have (from the URL just now, or a past visit).
    const token = getToken()
    if (token) {
        const payload = decodeJwt(token)
        // exp is in seconds; Date.now() is in milliseconds — hence × 1000.
        if (payload && payload.exp * 1000 > Date.now()) {
            user.value = { id: payload.id, email: payload.email, name: payload.name, avatar: payload.avatar }
        } else {
            clearToken() // token is missing pieces or has expired
        }
    }

    authLoading.value = false
}

/** Sign out: forget the token and clear the user. (No server call needed.) */
export function logout() {
    clearToken()
    user.value = null
}

/** Kick off Google sign-in by sending the browser to the server's auth route. */
export function signInWithGoogle() {
    const base = import.meta.env.VITE_API_URL ?? ''
    window.location.href = `${base}/auth/google`
}
