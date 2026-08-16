<script setup lang="ts">
import type { JournalResumePreviewPage } from '../../types';

defineProps<{
  pages: JournalResumePreviewPage[];
}>();
</script>

<template>
  <section class="pdf-stage" aria-label="PDF 简历预览">
    <ol class="pdf-pages">
      <li
        v-for="page in pages"
        :key="page.pageNumber"
        class="pdf-page"
      >
        <img
          class="pdf-page__image"
          :src="page.url"
          :width="page.width"
          :height="page.height"
          :alt="`简历第 ${page.pageNumber} 页，共 ${pages.length} 页`"
          :loading="page.pageNumber === 1 ? 'eager' : 'lazy'"
          :fetchpriority="page.pageNumber === 1 ? 'high' : 'auto'"
          decoding="async"
        >
      </li>
    </ol>
  </section>
</template>

<style scoped>
.pdf-stage {
  width: 100%;
  padding: clamp(0.65rem, 2vw, 1.35rem);
  border: 1px solid var(--border-subtle);
  border-radius: calc(var(--radius-card) + 4px);
  background: color-mix(in srgb, var(--surface-muted) 72%, var(--surface-page));
}

.pdf-pages {
  display: grid;
  width: min(100%, 900px);
  margin: 0 auto;
  padding: 0;
  gap: clamp(1rem, 2.5vw, 1.5rem);
  list-style: none;
}

.pdf-page {
  overflow: hidden;
  border-radius: 6px;
  background: #ffffff;
  box-shadow:
    0 18px 42px color-mix(in srgb, var(--ink) 14%, transparent),
    0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent);
}

.pdf-page__image {
  display: block;
  width: 100%;
  height: auto;
}

@media (max-width: 599px) {
  .pdf-stage {
    padding: 0.4rem;
    border-radius: 10px;
  }

  .pdf-pages {
    gap: 0.75rem;
  }

  .pdf-page {
    border-radius: 4px;
    box-shadow:
      0 10px 24px color-mix(in srgb, var(--ink) 12%, transparent),
      0 0 0 1px color-mix(in srgb, var(--ink) 7%, transparent);
  }
}
</style>
