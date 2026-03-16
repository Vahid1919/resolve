<template>
  <div class="dl-card">
    <div class="dl-card-head">
      <span class="dl-card-title">Deadlines</span>
      <span class="dl-card-badge" v-if="deadlines.length > 0">{{
        deadlines.length
      }}</span>
    </div>

    <div v-if="!dateKey" class="dl-card-empty">
      <span>Select a date to add deadlines</span>
    </div>

    <template v-else>
      <ul class="dl-card-list">
        <transition-group name="slide">
          <li v-for="dl in deadlines" :key="dl.id" class="dl-card-row">
            <span class="dl-card-dot"></span>
            <span class="dl-card-text">{{ dl.text }}</span>
            <button
              class="dl-card-del"
              @click="removeDeadline(dateKey, dl.id)"
              title="Remove"
            >
              <svg viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </li>
        </transition-group>
        <li v-if="deadlines.length === 0" class="dl-card-hint">
          No deadlines for this day
        </li>
      </ul>

      <div class="dl-card-form-wrap">
        <form v-if="showForm" class="dl-card-form" @submit.prevent="submit">
          <input
            v-model="newText"
            class="dl-card-input"
            placeholder="Add a deadline…"
            maxlength="120"
            autocomplete="off"
          />
          <button type="submit" class="dl-card-add">Add</button>
        </form>
        <button
          v-if="!showForm"
          class="dl-card-toggle"
          @click="showForm = true"
        >
          ＋ Add deadline
        </button>
        <button
          v-else
          class="dl-card-toggle dl-card-toggle--cancel"
          @click="
            showForm = false;
            newText = '';
          "
        >
          Cancel
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useTodos } from "../composables/useTodos.js";

const props = defineProps({ dateKey: { type: String, default: null } });
const { getDeadlines, addDeadline, removeDeadline } = useTodos();

const newText = ref("");
const showForm = ref(false);
const deadlines = computed(() =>
  props.dateKey ? getDeadlines(props.dateKey) : [],
);

function submit() {
  if (props.dateKey && newText.value.trim()) {
    addDeadline(props.dateKey, newText.value);
    newText.value = "";
    showForm.value = false;
  }
}
</script>
