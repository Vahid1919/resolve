/**
 * Persistent storage helpers for Resolve.
 *
 * All data is stored under the "resolve-" prefix.
 * On first access for each key, any data from the old "trackr-" prefix
 * is migrated automatically so existing users keep their data.
 */

const APP_PREFIX = 'resolve'

const LEGACY_KEY_MAP = {
  tasks:           'trackr-todos',
  completed:       'trackr-completed',
  habits:          'trackr-habit-defs',
  habitExceptions: 'trackr-habit-exc',
  habitDone:       'trackr-habit-done',
  areas:           'trackr-areas',
}

function resolveKey(name) {
  return `${APP_PREFIX}-${name}`
}

/** Copy data from a legacy key to the new key once, then remove the legacy key. */
function migrateIfNeeded(name) {
  const newKey    = resolveKey(name)
  const legacyKey = LEGACY_KEY_MAP[name]
  if (!legacyKey) return
  try {
    if (localStorage.getItem(newKey) !== null) return // already migrated
    const old = localStorage.getItem(legacyKey)
    if (old === null) return
    localStorage.setItem(newKey, old)
    localStorage.removeItem(legacyKey)
  } catch { /* ignore storage errors */ }
}

/** Load a plain object `{}` from storage, with optional migration. */
export function loadMap(name) {
  migrateIfNeeded(name)
  try {
    const raw = localStorage.getItem(resolveKey(name))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

/** Load an array `[]` from storage, with optional migration. */
export function loadList(name) {
  migrateIfNeeded(name)
  try {
    const raw = localStorage.getItem(resolveKey(name))
    const val = raw ? JSON.parse(raw) : []
    return Array.isArray(val) ? val : []
  } catch { return [] }
}

/** Persist any value under the given name. */
export function save(name, value) {
  try {
    localStorage.setItem(resolveKey(name), JSON.stringify(value))
  } catch { /* ignore quota/security errors */ }
}
