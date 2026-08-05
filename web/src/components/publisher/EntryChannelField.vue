<script setup lang="ts">
import { plainJournalChannels } from '../../journalChannels';
import type { JournalPlainChannel } from '../../types';

const channel = defineModel<JournalPlainChannel>({ required: true });

defineProps<{
  disabled: boolean;
}>();
</script>

<template>
  <fieldset class="channel-field" :disabled="disabled">
    <legend class="channel-field__label">内容频道</legend>
    <label
      v-for="option in plainJournalChannels"
      :key="option.value"
      class="channel-field__option"
    >
      <input v-model="channel" type="radio" :value="option.value">
      <span>
        <strong>{{ option.label }}</strong>
        <small>{{ option.description }}</small>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.channel-field {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.channel-field__label {
  margin-bottom: 0.1rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.channel-field__option {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
  cursor: pointer;
}

.channel-field__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.channel-field__option input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.channel-field__option span {
  display: grid;
  gap: 0.18rem;
}

.channel-field__option strong {
  font-size: 0.86rem;
}

.channel-field__option small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

@media (min-width: 1181px) {
  .channel-field {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .channel-field__label {
    grid-column: 1 / -1;
  }
}
</style>
