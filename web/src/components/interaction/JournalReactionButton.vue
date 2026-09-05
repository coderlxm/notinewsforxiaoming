<script setup lang="ts">
import { shallowRef } from 'vue';

const props = withDefaults(defineProps<{
  reacted: boolean;
  count: number;
  pending: boolean;
  variant?: 'card' | 'detail';
}>(), {
  variant: 'card',
});

const emit = defineEmits<{
  toggle: [];
}>();

const celebrating = shallowRef(false);

function toggle(): void {
  celebrating.value = !props.reacted;
  emit('toggle');
}

function finishCelebration(event: AnimationEvent): void {
  const finalAnimation = props.variant === 'detail' ? 'reaction-glow' : 'reaction-heart-pop';
  if (event.animationName === finalAnimation) celebrating.value = false;
}
</script>

<template>
  <button
    type="button"
    class="reaction-button"
    :class="[
      `reaction-button--${variant}`,
      {
        'reaction-button--reacted': reacted,
        'reaction-button--pending': pending,
        'reaction-button--celebrating': celebrating,
      },
    ]"
    :aria-pressed="reacted"
    :aria-busy="pending"
    :disabled="pending"
    @click="toggle"
  >
    <span class="reaction-button__heart" aria-hidden="true" @animationend="finishCelebration">
      <svg viewBox="0 0 24 24">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </span>
    <span v-if="variant === 'detail'" class="reaction-button__label">
      {{ reacted ? '已觉得不错' : '觉得不错' }}
    </span>
    <span v-if="count > 0" class="reaction-button__count">{{ count }}</span>
  </button>
</template>

<style scoped>
.reaction-button {
  --reaction-glow-opacity: 0.85;

  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 28px;
  padding: 0.2rem 0.35rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  line-height: 1;
  transition: color 160ms ease;
}

.reaction-button--detail {
  min-height: 40px;
  gap: 0.45rem;
  font-size: 0.86rem;
}

.reaction-button:hover:not(:disabled) {
  color: var(--accent-strong);
}

.reaction-button--reacted {
  color: var(--accent-strong);
}

.reaction-button:disabled {
  cursor: default;
}

.reaction-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: 0.5rem;
}

.reaction-button__heart {
  position: relative;
  display: inline-flex;
}

.reaction-button__heart svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
  transition: fill 160ms ease;
}

.reaction-button--detail .reaction-button__heart svg {
  width: 1.15em;
  height: 1.15em;
}

.reaction-button--reacted .reaction-button__heart svg {
  fill: currentColor;
}

.reaction-button--celebrating .reaction-button__heart {
  animation: reaction-heart-pop 420ms var(--ease-card);
}

.reaction-button--detail.reaction-button--celebrating .reaction-button__heart::after {
  position: absolute;
  inset: -7px;
  border-radius: 50%;
  background: var(--accent-soft);
  content: '';
  pointer-events: none;
  animation: reaction-glow 460ms var(--ease-card) forwards;
}

.reaction-button__label {
  white-space: nowrap;
}

.reaction-button__count {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@keyframes reaction-heart-pop {
  0% {
    transform: scale(1);
  }

  40% {
    transform: scale(1.18);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes reaction-glow {
  0% {
    opacity: var(--reaction-glow-opacity);
    transform: scale(0.6);
  }

  100% {
    opacity: 0;
    transform: scale(1.9);
  }
}

:global(html[data-theme='dark']) .reaction-button {
  --reaction-glow-opacity: 0.4;
}

@media (prefers-reduced-motion: reduce) {
  .reaction-button--celebrating .reaction-button__heart,
  .reaction-button--detail.reaction-button--celebrating .reaction-button__heart::after {
    animation: none;
  }
}
</style>
