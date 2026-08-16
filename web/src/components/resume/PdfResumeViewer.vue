<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  src: string;
}>();

const pdfViewerUrl = computed(() => {
  const hashIndex = props.src.indexOf('#');
  const base = hashIndex === -1 ? props.src : props.src.slice(0, hashIndex);
  return `${base}#toolbar=0&navpanes=0&view=FitH`;
});
</script>

<template>
  <div class="pdf-stage">
    <div class="pdf-paper">
      <iframe
        class="pdf-paper__frame"
        :src="pdfViewerUrl"
        title="小明同学的个人简历"
      />
    </div>
  </div>
</template>

<style scoped>
.pdf-stage {
  display: flex;
  justify-content: center;
  width: 100%;
}

.pdf-paper {
  width: 100%;
  max-width: 900px;
  height: min(calc(100dvh - 14rem), 84rem);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow:
    0 16px 36px color-mix(in srgb, var(--ink) 12%, transparent),
    0 0 0 1px var(--border-subtle);
  overflow: hidden;
  transition: box-shadow 180ms ease;
}

.pdf-paper:hover {
  box-shadow:
    0 20px 42px color-mix(in srgb, var(--ink) 16%, transparent),
    0 0 0 1px var(--border-strong);
}

.pdf-paper__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

@media (max-width: 599px) {
  .pdf-paper {
    height: min(calc(100dvh - 12rem), 62rem);
    border-radius: 8px;
  }
}
</style>