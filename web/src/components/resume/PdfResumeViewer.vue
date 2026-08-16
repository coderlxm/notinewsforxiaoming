<script setup lang="ts">
defineProps<{
  src: string;
}>();
</script>

<template>
  <iframe
    class="pdf-resume"
    :src="src"
    title="小明同学的个人简历"
  />
</template>

<style scoped>
.pdf-resume {
  display: block;
  width: 100%;
  height: min(calc(100dvh - 13rem), 82rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

@media (max-width: 599px) {
  .pdf-resume {
    height: min(calc(100dvh - 15rem), 60rem);
  }
}
</style>