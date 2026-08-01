<template>
  <div class="waterfall-placeholder" aria-hidden="true">
    <article v-for="index in 10" :key="index" class="waterfall-placeholder__card">
      <div class="waterfall-placeholder__media" />
    </article>
  </div>
</template>

<style scoped>
.waterfall-placeholder {
  columns: 2;
  column-gap: var(--waterfall-gap);
}

.waterfall-placeholder__card {
  margin: 0 0 var(--waterfall-gap);
  break-inside: avoid;
  border-radius: var(--radius-media);
  overflow: hidden;
}

.waterfall-placeholder__media {
  aspect-ratio: 4 / 5;
  background: color-mix(in srgb, var(--surface-muted) 58%, transparent);
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

@container (min-width: 1560px) {
  .waterfall-placeholder {
    columns: 6;
  }
}
</style>
