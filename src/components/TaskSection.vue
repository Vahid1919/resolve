<script setup>
import { ref, computed, nextTick } from 'vue'
import { useStore } from '../store/index.js'

const props = defineProps({
  dateKey:          { type: String,  required: true },
  readOnly:         { type: Boolean, default: false },
  activeAreaFilter: { type: Number,  default: null  },
})

const emit = defineEmits(['tag-menu'])

const {
  getTasks, addTask, removeTask, archiveTask, unarchiveTask,
  getCompleted, removeCompleted,
  areas, areaColor, areaName,
} = useStore()

// ── Filtered lists ────────────────────────────────────────────────────────────
const activeTasks = computed(() => {
  const all = getTasks(props.dateKey) || []
  return props.activeAreaFilter === null
    ? all
    : all.filter(t => t.areaId === props.activeAreaFilter)
})
const completedTasks = computed(() => {
  const all = getCompleted(props.dateKey) || []
  return props.activeAreaFilter === null
    ? all
    : all.filter(t => t.areaId === props.activeAreaFilter)
})

// ── Add form ──────────────────────────────────────────────────────────────────
const TASK_POOL = [
  'Review emails', 'Go for a walk', 'Read for 20 min', 'Plan tomorrow',
  'Call a friend', 'Clean workspace', 'Write in journal', 'Grocery run',
  'Study for 1 hour', 'Drink 2L water', 'Stretch for 10 min', 'Backup files',
  'Respond to messages', 'Organize desktop', 'Review notes',
]

function sample(arr, n) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

const showForm    = ref(false)
const newText     = ref('')
const newAreaId   = ref(null)
const suggestions = ref([])
const inputEl     = ref(null)

function openForm() {
  showForm.value    = true
  newText.value     = ''
  newAreaId.value   = null
  suggestions.value = sample(TASK_POOL, 4)
  nextTick(() => inputEl.value?.focus())
}

function closeForm() {
  showForm.value  = false
  newText.value   = ''
  newAreaId.value = null
}

function confirmAdd() {
  if (!newText.value.trim()) return
  addTask(props.dateKey, newText.value, newAreaId.value)
  closeForm()
}

function quickAdd(text) {
  addTask(props.dateKey, text, newAreaId.value)
  closeForm()
}
</script>

<template>
  <section aria-label="Tasks">

    <!-- Section header -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[13px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Tasks</h3>
      <button
        v-if="!readOnly"
        class="w-7 h-7 flex items-center justify-center rounded-[8px]
               border border-[var(--border)] bg-[var(--surface2)] text-[var(--text-muted)]
               cursor-pointer transition-all
               hover:bg-[var(--surface3)] hover:border-[var(--accent)] hover:text-[var(--text)]
               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        :class="{ 'bg-[var(--surface3)] border-[var(--accent)] text-[var(--text)] rotate-45': showForm }"
        @click="showForm ? closeForm() : openForm()"
        :aria-expanded="showForm"
        aria-label="Add task"
      >
        <svg viewBox="0 0 14 14" fill="none" width="12" height="12" aria-hidden="true">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Add form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="mb-3 flex flex-col gap-2">
        <!-- Area picker -->
        <div v-if="areas.length" class="flex flex-wrap gap-1" role="group" aria-label="Select area for task">
          <button
            class="px-2 py-0.5 rounded-full text-xs border border-[var(--border)] text-[var(--text-muted)]
                   transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]
                   focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            :class="{ 'border-[var(--accent)] text-[var(--text)]': newAreaId === null }"
            @click="newAreaId = null"
            :aria-pressed="newAreaId === null"
          >None</button>
          <button
            v-for="a in areas" :key="a.id"
            class="px-2 py-0.5 rounded-full text-xs border font-medium transition-opacity
                   focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            :style="{ background: a.color, borderColor: a.color, color: '#fff', opacity: newAreaId === a.id ? 1 : 0.5 }"
            @click="newAreaId = a.id"
            :aria-pressed="newAreaId === a.id"
          >{{ a.name }}</button>
        </div>
        <!-- Quick suggestions -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="s in suggestions" :key="s"
            class="px-2 py-0.5 rounded-full text-xs border border-[var(--border)] text-[var(--text-muted)]
                   cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]
                   focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            @click="quickAdd(s)"
          >{{ s }}</button>
        </div>
        <!-- Text input + add button -->
        <div class="flex gap-1.5">
          <input
            ref="inputEl"
            class="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface2)]
                   text-[var(--text)] text-sm placeholder-[var(--text-sub)] outline-none
                   focus:border-[var(--accent)] focus:bg-[var(--surface3)] transition-colors"
            v-model="newText"
            placeholder="Custom task..."
            maxlength="120"
            aria-label="Task description"
            @keydown.enter="confirmAdd"
            @keydown.esc="closeForm"
          />
          <button
            class="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold
                   cursor-pointer transition-all hover:bg-[var(--accent-dim)] hover:scale-[1.04]
                   active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @click="confirmAdd"
          >Add</button>
        </div>
      </div>
    </Transition>

    <!-- Active task list -->
    <TransitionGroup
      name="task-item" tag="ul"
      class="flex flex-col gap-0.5 mb-1"
      role="list" aria-label="Active tasks"
    >
      <li
        v-for="task in activeTasks" :key="task.id"
        class="group flex items-center gap-2 px-2 py-2 rounded-[10px]
               hover:bg-[var(--surface3)] transition-colors"
        role="listitem"
        @contextmenu.prevent="$emit('tag-menu', 'task', task.id, $event)"
      >
        <button
          v-if="!readOnly"
          class="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center rounded-full
                 border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] cursor-pointer
                 transition-all hover:border-[var(--accent)] hover:bg-[var(--surface3)]
                 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          @click="archiveTask(dateKey, task.id)"
          :aria-label="'Mark done: ' + task.text"
        >
          <svg viewBox="0 0 12 10" fill="none" width="9" height="9" aria-hidden="true">
            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span
          v-else
          class="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded
                 border border-[var(--border)] text-[var(--text-muted)]"
        >pending</span>

        <span
          v-if="task.areaId"
          class="w-[7px] h-[7px] rounded-full flex-shrink-0"
          :style="{ background: areaColor(task.areaId) }"
        />
        <span class="flex-1 text-[14px] text-[var(--text)] leading-snug">{{ task.text }}</span>
        <button
          v-if="!readOnly"
          class="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0
                 text-[var(--text-sub)] opacity-0 group-hover:opacity-100
                 hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all
                 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-[var(--danger)]"
          @click="removeTask(dateKey, task.id)"
          :aria-label="'Delete: ' + task.text"
        >
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </li>
    </TransitionGroup>

    <!-- Completed tasks -->
    <ul
      v-if="completedTasks.length"
      class="flex flex-col gap-0.5 mt-1 border-t border-[var(--border)] pt-2"
      role="list" aria-label="Completed tasks"
    >
      <li
        v-for="item in completedTasks" :key="item.id"
        class="group flex items-center gap-2 px-2 py-2 rounded-[10px]
               opacity-60 hover:opacity-80 hover:bg-[var(--surface3)] transition-all"
        role="listitem"
      >
        <button
          v-if="!readOnly"
          class="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center rounded-full
                 border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]
                 cursor-pointer transition-all hover:bg-[var(--surface3)] hover:border-[var(--border)]
                 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          @click="unarchiveTask(dateKey, item.id)"
          :aria-label="'Mark not done: ' + item.text"
        >
          <svg viewBox="0 0 12 10" fill="none" width="9" height="9" aria-hidden="true">
            <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span
          v-else
          class="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded
                 border border-[var(--accent)] text-[var(--accent)]"
        >done</span>

        <span
          v-if="item.areaId"
          class="w-[7px] h-[7px] rounded-full flex-shrink-0"
          :style="{ background: areaColor(item.areaId) }"
        />
        <span class="flex-1 text-[14px] text-[var(--text-muted)] line-through leading-snug">{{ item.text }}</span>
        <button
          v-if="!readOnly"
          class="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0
                 text-[var(--text-sub)] opacity-0 group-hover:opacity-100
                 hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-all
                 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-[var(--danger)]"
          @click="removeCompleted(dateKey, item.id)"
          :aria-label="'Remove: ' + item.text"
        >
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </li>
    </ul>

    <p v-if="!activeTasks.length && !completedTasks.length" class="text-[13px] text-[var(--text-sub)] px-2 py-1">
      No tasks yet.
    </p>

  </section>
</template>
