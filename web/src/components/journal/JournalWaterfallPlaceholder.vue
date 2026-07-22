<template>
  <div class="waterfall-placeholder" aria-hidden="true">
    <article v-for="index in 10" :key="index" class="waterfall-placeholder__card">
      <div class="waterfall-placeholder__date" />
      <div class="waterfall-placeholder__media" />
      <div class="waterfall-placeholder__copy" />
    </article>
  </div>
</template>

<style scoped>
.waterfall-placeholder {
  columns: 2;
  column-gap: var(--waterfall-gap);
}

.waterfall-placeholder__card {
  display: grid;
  margin: 0 0 var(--waterfall-gap);
  padding: 0.9rem;
  break-inside: avoid;
  gap: 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.waterfall-placeholder__date {
  width: min(5.25rem, 54%);
  height: 2.25rem;
  border-left: 3px solid color-mix(in srgb, var(--accent) 48%, var(--border-subtle));
  background: var(--surface-muted);
}

.waterfall-placeholder__media {
  aspect-ratio: 4 / 5;
  border-radius: var(--radius-media);
  background: color-mix(in srgb, var(--surface-muted) 84%, var(--accent-soft));
}

.waterfall-placeholder__copy {
  width: 72%;
  height: 2.8rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--surface-muted) 88%, transparent);
}

.waterfall-placeholder__card:nth-child(4n + 2) .waterfall-placeholder__media {
  aspect-ratio: 1;
}

.waterfall-placeholder__card:nth-child(4n + 3) .waterfall-placeholder__media {
  aspect-ratio: 3 / 4;
}

.waterfall-placeholder__card:nth-child(4n) .waterfall-placeholder__media {
  aspect-ratio: 4 / 3;
}

.waterfall-placeholder__card:nth-child(3n) .waterfall-placeholder__copy {
  width: 58%;
  height: 2.1rem;
}

@container (min-width: 720px) {
  .waterfall-placeholder {
    columns: 3;
  }
}

@container (min-width: 980px) {
  .waterfall-placeholder {
    columns: 4;
  }
}

@container (min-width: 1240px) {
  .waterfall-placeholder {
    columns: 5;
  }
}
</style>
