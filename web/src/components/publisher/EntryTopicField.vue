<script setup lang="ts">
const topic = defineModel<string>({ required: true });

defineProps<{
  disabled: boolean;
}>();
</script>

<template>
  <label class="field topic-field">
    <span class="field__label">主题（选填）</span>
    <input
      v-model="topic"
      type="text"
      maxlength="60"
      placeholder="用一句话概括这条内容"
      :disabled="disabled"
    >
  </label>
</template>

<style scoped>
.topic-field {
  min-width: 0;
}
</style>
