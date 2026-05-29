/**
 * utils.js — small, dependency-free helper functions shared across the app.
 *
 * These used to be copy-pasted into several files. Keeping a single copy here
 * means there is exactly one place to read (and one place to fix a bug).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  The "dateKey" convention (read this first!)
 * ──────────────────────────────────────────────────────────────────────────────
 *  Throughout Resolve, a single day is identified by a plain string like
 *  "2026-05-29"  (YYYY-MM-DD).  We call this a "dateKey".
 *
 *  Why a string instead of a JavaScript Date object?
 *    • It is unambiguous — no timezone surprises (a Date is a moment in time;
 *      a dateKey is just "this calendar day").
 *    • It sorts correctly with normal string comparison ("2026-01-02" < "2026-01-10").
 *    • It is a perfect object key, so we can store data as { [dateKey]: [...] }.
 *
 *  The two functions below convert between a dateKey string and a Date object.
 */

/**
 * Turn a Date object into a "YYYY-MM-DD" dateKey, using the browser's LOCAL
 * date (not UTC). padStart makes sure single-digit months/days get a leading
 * zero, e.g. month 3 → "03".
 */
export function toDateKey(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0') // getMonth() is 0-based
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Turn a "YYYY-MM-DD" dateKey back into a Date object set to local midnight.
 * We split on "-" and subtract 1 from the month because JavaScript months are
 * 0-based (January = 0).
 */
export function parseDateKey(key) {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/**
 * Given a dateKey, return the dateKey for the day BEFORE it.
 * Used by the habit logic (e.g. "stop this habit the day before X").
 * setDate() with a smaller number automatically rolls back across month/year
 * boundaries (e.g. the day before "2026-03-01" becomes "2026-02-28").
 */
export function prevDateKey(key) {
    const date = parseDateKey(key)
    date.setDate(date.getDate() - 1)
    return toDateKey(date)
}

/**
 * Return `n` random items from `arr`, without repeats.
 * Used to show a few random "quick add" suggestions in the task/habit forms.
 *
 * It copies the array (so the original is untouched), shuffles the copy with the
 * Fisher–Yates algorithm, then takes the first `n` items.
 */
export function sample(arr, n) {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]] // swap copy[i] and copy[j]
    }
    return copy.slice(0, n)
}
