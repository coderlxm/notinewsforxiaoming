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
        <div class="pdf-page__images">
          <img
            class="pdf-page__image pdf-page__image--light"
            :src="page.lightUrl"
            :width="page.width"
            :height="page.height"
            :alt="`简历第 ${page.pageNumber} 页，共 ${pages.length} 页`"
            :loading="page.pageNumber === 1 ? 'eager' : 'lazy'"
            :fetchpriority="page.pageNumber === 1 ? 'high' : 'auto'"
            decoding="async"
          >
          <img
            class="pdf-page__image pdf-page__image--dark"
            :src="page.darkUrl"
            :width="page.width"
            :height="page.height"
            alt=""
            aria-hidden="true"
            :loading="page.pageNumber === 1 ? 'eager' : 'lazy'"
            decoding="async"
          >
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.pdf-stage {
  width: 100%;
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
  background: var(--surface-card);
  box-shadow:
    0 12px 30px color-mix(in srgb, var(--ink) 10%, transparent),
    0 0 0 1px var(--border-subtle);
}

.pdf-page__images {
  position: relative;
}

.pdf-page__image {
  display: block;
  width: 100%;
  height: auto;
}

.pdf-page__image--dark {
  position: absolute;
  inset: 0;
  opacity: 0;
}

:global(html[data-theme='dark'] .pdf-page__image--light) {
  opacity: 0;
}

:global(html[data-theme='dark'] .pdf-page__image--dark) {
  opacity: 1;
}

@media (max-width: 599px) {
  .pdf-pages {
    gap: 0.75rem;
  }

  .pdf-page {
    border-radius: 4px;
    box-shadow:
      0 8px 20px color-mix(in srgb, var(--ink) 9%, transparent),
      0 0 0 1px var(--border-subtle);
  }
}
</style>
