<script setup lang="ts">
import type { JournalVisibility } from '../../types';

const visibility = defineModel<JournalVisibility>({ required: true });

defineProps<{
  disabled: boolean;
}>();
</script>

<template>
  <fieldset class="visibility-field" :disabled="disabled">
    <legend class="visibility-field__label">发布范围</legend>
    <label class="visibility-field__option">
      <input v-model="visibility" type="radio" value="public">
      <span>
        <strong>公开</strong>
        <small>显示在公开信息流、RSS 和 JSON Feed</small>
      </span>
    </label>
    <label class="visibility-field__option">
      <input v-model="visibility" type="radio" value="private">
      <span>
        <strong>私有</strong>
        <small>只保存在“我的全部记录”中</small>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.visibility-field {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.visibility-field__label {
  margin-bottom: 0.1rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.visibility-field__option {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
  cursor: pointer;
}

.visibility-field__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.visibility-field__option input {
  flex: none;
  margin: 0.18rem 0 0;
}

.visibility-field__option span {
  display: grid;
  gap: 0.18rem;
}

.visibility-field__option strong {
  font-size: 0.86rem;
}

.visibility-field__option small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}
</style>
