<script setup lang="ts">
import { ref, watch } from 'vue';
import { parseTagsInput, tagsInputToString } from '../../types';

const title = defineModel<string>('title', { default: '' });
const tags = defineModel<string[]>('tags', { default: () => [] });

const tagsInput = ref(tagsInputToString(tags.value));

watch(tags, (next) => {
  const text = tagsInputToString(next);
  if (text !== tagsInput.value) tagsInput.value = text;
});

function commitTagsInput(): void {
  tags.value = parseTagsInput(tagsInput.value);
}
</script>

<template>
  <div class="meta">
    <label class="field meta__title">
      <span class="field__label">标题</span>
      <input
        v-model="title"
        type="text"
        maxlength="120"
        placeholder="文章标题（1–120 字）"
        required
      >
    </label>
    <label class="field meta__tags">
      <span class="field__label">标签（逗号分隔，最多 20 个）</span>
      <input
        v-model="tagsInput"
        type="text"
        placeholder="例如：生活, 随笔"
        @blur="commitTagsInput"
        @keydown.enter.prevent="commitTagsInput"
      >
    </label>
  </div>
</template>

<style scoped>
.meta {
  display: grid;
  gap: 0.7rem;
}

.meta__title input {
  font-family: var(--font-serif);
  font-size: 1.05rem;
}
</style>
