<!--
  TaskSection.vue — the "Tasks" block shown in the day view.

  Features packed in here:
    • An add form with random suggestions, area tagging, and Tab-to-make-subtask.
    • Inline editing (double-click a task), with Tab / Shift-Tab to (un)indent.
    • Drag-and-drop reordering, plus a drop zone to move a task to the very end.
    • A completed-tasks list below the active one.
  All data changes go through the store functions; this file is just the UI.
-->
<script setup>
import { ref, computed, nextTick } from "vue";
import { useStore } from "../store.js";
import { sample } from "../utils.js";

const props = defineProps({
  dateKey: { type: String, required: true },     // the day these tasks belong to
  readOnly: { type: Boolean, default: false },    // past days can't be edited
  activeAreaFilter: { type: Number, default: null }, // null = show all areas
});

const emit = defineEmits(["tag-menu"]); // ask the parent to open the area menu

const {
  getTasks,
  addTask,
  removeTask,
  archiveTask,
  unarchiveTask,
  getCompleted,
  removeCompleted,
  editTaskText,
  reorderTasks,
  setTaskParent,
  areas,
  areaColor,
} = useStore();

// ── Filtered lists ────────────────────────────────────────────────────────────
const activeTasks = computed(() => {
  const all = getTasks(props.dateKey) || [];
  return props.activeAreaFilter === null
    ? all
    : all.filter((t) => t.areaId === props.activeAreaFilter);
});
const completedTasks = computed(() => {
  const all = getCompleted(props.dateKey) || [];
  return props.activeAreaFilter === null
    ? all
    : all.filter((t) => t.areaId === props.activeAreaFilter);
});

// ── Add form ──────────────────────────────────────────────────────────────────
// A pool of example tasks; openForm() picks 4 at random as one-tap suggestions.
const TASK_POOL = [
  "Review emails",
  "Go for a walk",
  "Read for 20 min",
  "Plan tomorrow",
  "Call a friend",
  "Clean workspace",
  "Write in journal",
  "Grocery run",
  "Study for 1 hour",
  "Drink 2L water",
  "Stretch for 10 min",
  "Backup files",
  "Respond to messages",
  "Organize desktop",
  "Review notes",
];

const showForm = ref(false);
const newText = ref("");
const newAreaId = ref(null);
const newParentId = ref(null);
const suggestions = ref([]);
const inputEl = ref(null);

function openForm() {
  showForm.value = true;
  newText.value = "";
  newAreaId.value = null;
  newParentId.value = null;
  suggestions.value = sample(TASK_POOL, 4);
  nextTick(() => inputEl.value?.focus());
}

function closeForm() {
  showForm.value = false;
  newText.value = "";
  newAreaId.value = null;
  newParentId.value = null;
}

function confirmAdd() {
  if (!newText.value.trim()) return;
  addTask(props.dateKey, newText.value, newAreaId.value, newParentId.value);
  closeForm();
}

function quickAdd(text) {
  addTask(props.dateKey, text, newAreaId.value, null);
  closeForm();
}

function handleInputKeydown(e) {
  if (e.key === "Tab") {
    e.preventDefault();
    // Toggle subtask: Tab → indent under last top-level task; Tab again → unindent
    if (newParentId.value) {
      newParentId.value = null;
    } else {
      const topLevel = [...activeTasks.value]
        .reverse()
        .find((t) => !t.parentId);
      if (topLevel) newParentId.value = topLevel.id;
    }
    return;
  }
  if (e.key === "Enter") confirmAdd();
  if (e.key === "Escape") closeForm();
}

function parentName(parentId) {
  return activeTasks.value.find((t) => t.id === parentId)?.text ?? "";
}

// ── Inline editing ────────────────────────────────────────────────────────────
const editingId = ref(null);
const editText = ref("");

function startEdit(task) {
  if (props.readOnly || editingId.value === task.id) return;
  editingId.value = task.id;
  editText.value = task.text;
  nextTick(() => {
    const el = document.getElementById(`te-${task.id}`);
    if (el) {
      el.focus();
      el.select();
    }
  });
}

function confirmEdit(task) {
  if (editingId.value !== task.id) return;
  if (editText.value.trim() && editText.value.trim() !== task.text) {
    editTaskText(props.dateKey, task.id, editText.value.trim());
  }
  editingId.value = null;
}

function cancelEdit() {
  editingId.value = null;
}

// Keyboard shortcuts while editing a task inline:
//   Enter → save, Escape → cancel,
//   Tab → indent (become a subtask of the task above),
//   Shift+Tab → outdent (back to a top-level task).
function handleEditKeydown(e, task, idx) {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmEdit(task);
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    cancelEdit();
    return;
  }
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    if (idx > 0) {
      // Attach to the task above — to ITS parent if it's already a subtask,
      // otherwise to the task above itself.
      const above = activeTasks.value[idx - 1];
      const pid = above.parentId ?? above.id;
      if (pid !== task.id && pid !== task.parentId) {
        setTaskParent(props.dateKey, task.id, pid);
      }
    }
  } else if (e.key === "Tab" && e.shiftKey) {
    e.preventDefault();
    if (task.parentId) setTaskParent(props.dateKey, task.id, null);
  }
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
// `draggedId` = the row being dragged; `dragOverId` = the row (or "__end__"
// drop zone) currently hovered, used to draw the insertion indicator.
const draggedId = ref(null);
const dragOverId = ref(null);

// When a drag begins, stash the task id and its day on the drag event. Both this
// component (reorder) and Calendar.vue (move to another day) read these back.
function onDragStart(e, task) {
  draggedId.value = task.id;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("task-id", String(task.id));
  e.dataTransfer.setData("from-date", props.dateKey);
}

function onTaskDragOver(e, task) {
  if (!e.dataTransfer.types.includes("task-id")) return;
  e.preventDefault();
  dragOverId.value = task.id;
}

function onTaskDrop(e, task) {
  e.preventDefault();
  e.stopPropagation();
  const fromDate = e.dataTransfer.getData("from-date");
  const tid = Number(e.dataTransfer.getData("task-id"));
  if (fromDate === props.dateKey && tid !== task.id) {
    reorderTasks(props.dateKey, tid, task.id);
  }
  draggedId.value = null;
  dragOverId.value = null;
}

function onEndZoneDragOver(e) {
  if (!e.dataTransfer.types.includes("task-id")) return;
  e.preventDefault();
  dragOverId.value = "__end__";
}

function onEndZoneDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const fromDate = e.dataTransfer.getData("from-date");
  const tid = Number(e.dataTransfer.getData("task-id"));
  if (fromDate === props.dateKey && tid) {
    reorderTasks(props.dateKey, tid, null);
  }
  draggedId.value = null;
  dragOverId.value = null;
}

function onDragEnd() {
  draggedId.value = null;
  dragOverId.value = null;
}
</script>

<template>
  <section aria-label="Tasks">
    <!-- Section header -->
    <div class="flex items-center justify-between mb-3">
      <h3
        class="text-[13px] font-bold uppercase tracking-wider text-(--text-muted)"
      >
        Tasks
      </h3>
      <button
        v-if="!readOnly"
        class="w-7 h-7 flex items-center justify-center rounded-[8px] border border-(--border) bg-(--surface2) text-(--text-muted) cursor-pointer transition-all hover:bg-(--surface3) hover:border-(--accent) hover:text-(--text)"
        :class="{
          'bg-(--surface3) border-(--accent) text-(--text) rotate-45': showForm,
        }"
        @click="showForm ? closeForm() : openForm()"
        :aria-expanded="showForm"
        aria-label="Add task"
      >
        <svg
          viewBox="0 0 14 14"
          fill="none"
          width="12"
          height="12"
          aria-hidden="true"
        >
          <path
            d="M7 1v12M1 7h12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <!-- Add form -->
    <Transition name="slide-down">
      <div v-if="showForm" class="mb-3 flex flex-col gap-2">
        <!-- Area picker -->
        <div
          v-if="areas.length"
          class="flex flex-wrap gap-1"
          role="group"
          aria-label="Select area for task"
        >
          <button
            class="px-2 py-0.5 rounded-full text-xs border border-(--border) text-(--text-muted) transition-colors hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :class="{
              'border-(--accent) text-(--text)': newAreaId === null,
            }"
            @click="newAreaId = null"
            :aria-pressed="newAreaId === null"
          >
            None
          </button>
          <button
            v-for="a in areas"
            :key="a.id"
            class="px-2 py-0.5 rounded-full text-xs border font-medium transition-opacity focus:outline-none focus:ring-1 focus:ring-(--accent)"
            :style="{
              background: a.color,
              borderColor: a.color,
              color: '#fff',
              opacity: newAreaId === a.id ? 1 : 0.5,
            }"
            @click="newAreaId = a.id"
            :aria-pressed="newAreaId === a.id"
          >
            {{ a.name }}
          </button>
        </div>
        <!-- Quick suggestions -->
        <div class="flex flex-wrap gap-1">
          <button
            v-for="s in suggestions"
            :key="s"
            class="px-2 py-0.5 rounded-full text-xs border border-(--border) text-(--text-muted) cursor-pointer transition-colors hover:border-(--accent) hover:text-(--text) focus:outline-none focus:ring-1 focus:ring-(--accent)"
            @click="quickAdd(s)"
          >
            {{ s }}
          </button>
        </div>
        <!-- Subtask indicator -->
        <div
          v-if="newParentId"
          class="flex items-center gap-1.5 text-xs text-(--text-muted) px-1"
        >
          <svg
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 2v7h7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="truncate"
            >Subtask of "{{ parentName(newParentId) }}"</span
          >
          <button
            class="ml-auto text-(--text-sub) hover:text-(--text)"
            @click="newParentId = null"
            aria-label="Remove indent"
          >
            ×
          </button>
        </div>
        <!-- Text input + add button -->
        <div class="flex gap-1.5">
          <input
            ref="inputEl"
            class="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--surface2) text-(--text) text-sm placeholder-(--text-sub) outline-none focus:border-(--accent) focus:bg-(--surface3) transition-colors"
            v-model="newText"
            placeholder="New task… (Tab to indent)"
            maxlength="120"
            aria-label="Task description"
            @keydown="handleInputKeydown"
          />
          <button
            class="px-4 py-2 rounded-lg bg-(--accent) text-(--bg) text-sm font-semibold cursor-pointer transition-all hover:bg-(--accent-dim) hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-(--accent)"
            @click="confirmAdd"
          >
            Add
          </button>
        </div>
      </div>
    </Transition>

    <!-- Active task list -->
    <ul class="flex flex-col mb-1" role="list" aria-label="Active tasks">
      <li
        v-for="(task, idx) in activeTasks"
        :key="task.id"
        draggable="true"
        class="group relative flex items-center gap-2 px-2 py-2 rounded-[10px] transition-colors select-none"
        :class="{
          'hover:bg-(--surface3)': editingId !== task.id,
          'opacity-40': draggedId === task.id,
          'border-t-2 border-(--accent)': dragOverId === task.id,
        }"
        :style="task.parentId ? { paddingLeft: '1.75rem' } : {}"
        role="listitem"
        @dblclick="startEdit(task)"
        @contextmenu.prevent="$emit('tag-menu', 'task', task.id, $event)"
        @dragstart="onDragStart($event, task)"
        @dragover="onTaskDragOver($event, task)"
        @drop="onTaskDrop($event, task)"
        @dragend="onDragEnd"
      >
        <!-- Subtask indent line -->
        <span
          v-if="task.parentId"
          class="absolute left-[14px] top-0 bottom-0 w-px bg-(--border)"
          aria-hidden="true"
        />

        <!-- Drag handle -->
        <span
          v-if="!readOnly"
          class="shrink-0 text-(--text-sub) opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing transition-opacity"
          aria-hidden="true"
        >
          <svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor">
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="6.5" r="1.2" />
            <circle cx="6" cy="6.5" r="1.2" />
            <circle cx="2" cy="11" r="1.2" />
            <circle cx="6" cy="11" r="1.2" />
          </svg>
        </span>

        <button
          v-if="!readOnly"
          class="w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full border border-(--border) bg-(--surface2) text-transparent cursor-pointer transition-all hover:border-(--accent) hover:bg-(--surface3) hover:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--accent)"
          @click.stop="archiveTask(dateKey, task.id)"
          :aria-label="'Mark done: ' + task.text"
        >
          <svg
            viewBox="0 0 12 10"
            fill="none"
            width="9"
            height="9"
            aria-hidden="true"
          >
            <path
              d="M1 5l3.5 3.5L11 1"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <span
          v-else
          class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-(--border) text-(--text-muted)"
          >pending</span
        >

        <span
          v-if="task.areaId"
          class="w-1.75 h-1.75 rounded-full shrink-0"
          :style="{ background: areaColor(task.areaId) }"
        />

        <!-- Task text (display) or edit input -->
        <span
          v-if="editingId !== task.id"
          class="flex-1 text-[14px] text-(--text) leading-snug"
          :title="!readOnly ? 'Double-click to edit' : undefined"
          >{{ task.text }}</span
        >
        <input
          v-else
          :id="`te-${task.id}`"
          v-model="editText"
          class="flex-1 text-[14px] text-(--text) bg-(--surface3) rounded px-1.5 py-0.5 outline-none border border-(--accent) leading-snug min-w-0"
          maxlength="120"
          @keydown="handleEditKeydown($event, task, idx)"
          @blur="confirmEdit(task)"
          @click.stop
          @dblclick.stop
        />

        <button
          v-if="!readOnly"
          class="w-5 h-5 flex items-center justify-center rounded-md shrink-0 text-(--text-sub) opacity-0 group-hover:opacity-100 hover:text-(--danger) hover:bg-(--danger-soft) transition-all focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-(--danger)"
          @click.stop="removeTask(dateKey, task.id)"
          :aria-label="'Delete: ' + task.text"
        >
          <svg
            viewBox="0 0 14 14"
            fill="none"
            width="11"
            height="11"
            aria-hidden="true"
          >
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </li>

      <!-- Drop zone: reorder to last position -->
      <li
        v-if="!readOnly && activeTasks.length"
        class="h-4 rounded transition-colors"
        :class="{ 'bg-(--accent-soft)': dragOverId === '__end__' }"
        @dragover="onEndZoneDragOver"
        @dragleave="dragOverId = null"
        @drop="onEndZoneDrop"
        aria-hidden="true"
      />
    </ul>

    <!-- Completed tasks -->
    <ul
      v-if="completedTasks.length"
      class="flex flex-col gap-0.5 mt-1 border-t border-(--border) pt-2"
      role="list"
      aria-label="Completed tasks"
    >
      <li
        v-for="item in completedTasks"
        :key="item.id"
        class="group flex items-center gap-2 px-2 py-2 rounded-[10px] opacity-60 hover:opacity-80 hover:bg-(--surface3) transition-all"
        role="listitem"
      >
        <button
          v-if="!readOnly"
          class="w-[18px] h-[18px] shrink-0 flex items-center justify-center rounded-full border border-(--accent) bg-(--accent-soft) text-(--accent) cursor-pointer transition-all hover:bg-(--surface3) hover:border-(--border) focus:outline-none focus:ring-2 focus:ring-(--accent)"
          @click="unarchiveTask(dateKey, item.id)"
          :aria-label="'Mark not done: ' + item.text"
        >
          <svg
            viewBox="0 0 12 10"
            fill="none"
            width="9"
            height="9"
            aria-hidden="true"
          >
            <path
              d="M1 5l3.5 3.5L11 1"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <span
          v-else
          class="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-(--accent) text-(--accent)"
          >done</span
        >

        <span
          v-if="item.areaId"
          class="w-1.75 h-1.75 rounded-full shrink-0"
          :style="{ background: areaColor(item.areaId) }"
        />
        <span
          class="flex-1 text-[14px] text-(--text-muted) line-through leading-snug"
          >{{ item.text }}</span
        >
        <button
          v-if="!readOnly"
          class="w-5 h-5 flex items-center justify-center rounded-md shrink-0 text-(--text-sub) opacity-0 group-hover:opacity-100 hover:text-(--danger) hover:bg-(--danger-soft) transition-all focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-(--danger)"
          @click="removeCompleted(dateKey, item.id)"
          :aria-label="'Remove: ' + item.text"
        >
          <svg
            viewBox="0 0 14 14"
            fill="none"
            width="11"
            height="11"
            aria-hidden="true"
          >
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </li>
    </ul>

    <p
      v-if="!activeTasks.length && !completedTasks.length"
      class="text-[13px] text-(--text-sub) px-2 py-1"
    >
      No tasks yet.
    </p>
  </section>
</template>
