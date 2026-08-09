<script setup lang="ts">
import JournalLoading from './JournalLoading.vue';

defineProps<{
  label: string;
  busyLabel: string;
  disabled: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  generate: [];
}>();
</script>

<template>
  <button
    class="ai-suggestion-button"
    type="button"
    :disabled="disabled || busy"
    :aria-busy="busy"
    @click="emit('generate')"
  >
    <JournalLoading v-if="busy" variant="inline" :label="busyLabel" />
    <template v-else>{{ label }}</template>
  </button>
</template>

<style scoped>
.ai-suggestion-button {
  min-height: 1.75rem;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.ai-suggestion-button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.ai-suggestion-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.ai-suggestion-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
