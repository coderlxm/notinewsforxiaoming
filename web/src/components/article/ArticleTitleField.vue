<script setup lang="ts">
const title = defineModel<string>({ default: '' });
</script>

<template>
  <label class="field article-title-field">
    <span class="field__label">标题</span>
    <input
      v-model="title"
      class="article-title-field__input"
      type="text"
      maxlength="120"
      placeholder="文章标题（1–120 字）"
      required
    >
  </label>
</template>

<style scoped>
.article-title-field__input {
  font-family: var(--font-serif);
  font-size: 1.05rem;
}
</style>
