<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'canvas' | 'reading' | 'inline';
  label: string;
}>(), {
  variant: 'reading',
});
</script>

<template>
  <div
    v-if="variant !== 'inline'"
    class="journal-loading"
    :class="`journal-loading--${variant}`"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="journal-loading__card" aria-hidden="true">
      <div class="journal-loading__spine"></div>
      <div class="journal-loading__lines">
        <div class="journal-loading__line journal-loading__line--1"></div>
        <div class="journal-loading__line journal-loading__line--2"></div>
        <div class="journal-loading__line journal-loading__line--3"></div>
      </div>
    </div>
    <p class="journal-loading__label">{{ label }}</p>
  </div>

  <span
    v-else
    class="journal-loading--inline"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="journal-loading__spine-inline" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.journal-loading--reading,
.journal-loading--canvas {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1.1rem;
}

.journal-loading--reading {
  min-height: clamp(20rem, 48vh, 34rem);
}

.journal-loading--canvas {
  min-height: clamp(18rem, 42vh, 30rem);
}

.journal-loading__card {
  display: flex;
  width: 9rem;
  min-height: 4.25rem;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.journal-loading__spine {
  width: 0.32rem;
  flex-shrink: 0;
  background: var(--accent);
  animation: jl-breathe 1600ms ease-in-out infinite;
}

.journal-loading__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1rem 1.1rem;
}

.journal-loading__line {
  height: 0.36rem;
  border-radius: 2px;
  background: var(--border-subtle);
  animation: jl-breathe 1600ms ease-in-out infinite;
}

.journal-loading__line--1 {
  width: 78%;
  animation-delay: 200ms;
}

.journal-loading__line--2 {
  width: 100%;
  animation-delay: 400ms;
}

.journal-loading__line--3 {
  width: 65%;
  animation-delay: 600ms;
}

@keyframes jl-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.42; }
}

.journal-loading__label {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.journal-loading--inline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.journal-loading__spine-inline {
  width: 0.22rem;
  height: 0.85em;
  border-radius: 1px;
  background: var(--accent);
  animation: jl-breathe 1600ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .journal-loading__spine,
  .journal-loading__line,
  .journal-loading__spine-inline {
    animation: none;
  }
}
</style>
