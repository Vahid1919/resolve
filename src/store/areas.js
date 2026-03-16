/**
 * Area store — manages named, color-coded project areas.
 *
 * Areas shape: { id: number, name: string, color: string }
 *
 * When an area is deleted, all task and habit references to it are cleared.
 */

import { reactive, watch } from 'vue'
import { loadList, save } from './storage.js'
import { tasksByDate } from './tasks.js'
import { habitDefs } from './habits.js'

// ── Reactive state ────────────────────────────────────────────────────────────
export const areas = reactive(loadList('areas'))

// ── Persistence watcher ───────────────────────────────────────────────────────
watch(areas, v => save('areas', v), { deep: true })

// ── Operations ────────────────────────────────────────────────────────────────

export function addArea(name, color) {
  if (!name.trim()) return
  areas.push({ id: Date.now(), name: name.trim(), color })
}

export function removeArea(id) {
  const idx = areas.findIndex(a => a.id === id)
  if (idx !== -1) areas.splice(idx, 1)

  // Clear the deleted area from all tasks and habits
  for (const tasks of Object.values(tasksByDate)) {
    for (const task of tasks) {
      if (task.areaId === id) task.areaId = null
    }
  }
  for (const habit of habitDefs) {
    if (habit.areaId === id) habit.areaId = null
  }
}

export function updateArea(id, fields) {
  const area = areas.find(a => a.id === id)
  if (!area) return
  if (fields.name  !== undefined) area.name  = fields.name.trim() || area.name
  if (fields.color !== undefined) area.color = fields.color
}

/** Returns the hex color for an area id, or null if not found. */
export function getAreaColor(id) {
  return areas.find(a => a.id === id)?.color ?? null
}

/** Returns the display name for an area id, or '' if not found. */
export function getAreaName(id) {
  return areas.find(a => a.id === id)?.name ?? ''
}
