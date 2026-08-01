<template>
  <div class="article-placeholder" role="status" aria-label="正在读取文章">
    <article v-for="index in 6" :key="index" class="article-placeholder__card">
      <div class="article-placeholder__date" />
      <div v-if="index % 3 !== 0" class="article-placeholder__cover" />
      <div class="article-placeholder__title" />
      <div class="article-placeholder__line article-placeholder__line--long" />
      <div class="article-placeholder__line article-placeholder__line--short" />
    </article>
  </div>
</template>

<style scoped>
.article-placeholder {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--waterfall-gap);
}

.article-placeholder__card {
  display: grid;
  align-content: start;
  gap: 0.8rem;
  min-height: 16rem;
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.article-placeholder__date,
.article-placeholder__cover,
.article-placeholder__title,
.article-placeholder__line {
  border-radius: 6px;
  background: var(--surface-muted);
  animation: article-placeholder-pulse 1.4s ease-in-out infinite;
}

.article-placeholder__date {
  width: 5rem;
  height: 1.8rem;
}

.article-placeholder__cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-media);
}

.article-placeholder__title {
  width: 72%;
  height: 1.35rem;
}

.article-placeholder__line {
  height: 0.78rem;
}

.article-placeholder__line--long {
  width: 94%;
}

.article-placeholder__line--short {
  width: 62%;
}

@keyframes article-placeholder-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 1199px) {
  .article-placeholder {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .article-placeholder {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
