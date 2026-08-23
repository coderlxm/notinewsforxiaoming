<script setup lang="ts">
defineProps<{
  name: string;
  photoCount: number;
  dateRange: string | null;
}>();
</script>

<template>
  <header class="photo-album-toolbar">
    <div class="photo-album-toolbar__surface">
      <RouterLink class="photo-album-toolbar__back" to="/photos" aria-label="返回照片墙">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </RouterLink>

      <div class="photo-album-toolbar__copy">
        <h1 class="photo-album-toolbar__title">{{ name }}</h1>
        <p class="photo-album-toolbar__summary">
          <span>{{ photoCount }} 张照片</span>
          <span v-if="dateRange">{{ dateRange }}</span>
        </p>
      </div>
    </div>
  </header>
</template>

<style scoped>
.photo-album-toolbar {
  position: sticky;
  z-index: 5;
  top: var(--photo-edge);
  width: max-content;
  max-width: 100%;
  height: 0;
}

.photo-album-toolbar__surface {
  display: flex;
  max-width: min(34rem, 100%);
  min-height: 3.25rem;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--photo-border);
  border-radius: 999px;
  background: var(--photo-glass-bg);
  box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.photo-album-toolbar__back {
  display: grid;
  width: 3.25rem;
  flex: 0 0 auto;
  border-right: 1px solid var(--photo-border);
  color: var(--photo-text-secondary);
  text-decoration: none;
  place-items: center;
  transition: background-color 160ms ease, color 160ms ease;
}

.photo-album-toolbar__back:hover {
  background: var(--photo-surface-hover);
  color: var(--photo-text-primary);
}

.photo-album-toolbar__back svg {
  width: 1.1rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.photo-album-toolbar__copy {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 0.12rem;
  padding: 0.48rem 1rem 0.5rem 0.85rem;
}

.photo-album-toolbar__title,
.photo-album-toolbar__summary {
  margin: 0;
}

.photo-album-toolbar__title {
  overflow: hidden;
  color: var(--photo-text-primary);
  font-family: var(--font-serif);
  font-size: 0.94rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-album-toolbar__summary {
  display: flex;
  overflow: hidden;
  gap: 0.6rem;
  color: var(--photo-text-muted);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .photo-album-toolbar {
    top: max(var(--photo-edge), env(safe-area-inset-top));
  }

  .photo-album-toolbar__surface {
    min-height: 3rem;
  }

  .photo-album-toolbar__back {
    width: 3rem;
  }

  .photo-album-toolbar__copy {
    padding-right: 0.85rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-album-toolbar__back {
    transition: none;
  }
}
</style>
