<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import {
  THEME_MODE_CYCLE,
  THEME_MODE_NAMES,
} from '../../theme/constants';
import type { ThemeMode, ThemeOrigin } from '../../theme/types';
import { useJournalTheme } from '../../theme/useJournalTheme';
import ThemeModeIcon from './ThemeModeIcon.vue';

const icon = useTemplateRef<HTMLSpanElement>('icon');

function elementCenter(element: HTMLElement): ThemeOrigin {
  const bounds = element.getBoundingClientRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}

function resolveIconOrigin(): ThemeOrigin {
  return elementCenter(icon.value!);
}

const { storedMode, transitioning, selectMode } = useJournalTheme(resolveIconOrigin);
const nextMode = computed<ThemeMode>(() => {
  const currentIndex = THEME_MODE_CYCLE.indexOf(storedMode.value);
  return THEME_MODE_CYCLE[(currentIndex + 1) % THEME_MODE_CYCLE.length];
});
const buttonLabel = computed(() =>
  `当前为${THEME_MODE_NAMES[storedMode.value]}，切换为${THEME_MODE_NAMES[nextMode.value]}`,
);

function cycleMode(): void {
  selectMode(nextMode.value, resolveIconOrigin());
}
</script>

<template>
  <button
    class="theme-mode-control"
    type="button"
    :aria-label="buttonLabel"
    :disabled="transitioning"
    @click="cycleMode"
  >
    <span ref="icon" class="theme-mode-control__icon">
      <ThemeModeIcon :mode="storedMode" />
    </span>
  </button>
</template>

<style scoped>
.theme-mode-control {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  place-items: center;
}

.theme-mode-control__icon {
  position: relative;
  display: grid;
  width: 1.12rem;
  height: 1.12rem;
  opacity: 0.76;
  place-items: center;
  transition: color 180ms ease, opacity 180ms ease;
}

.theme-mode-control__icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.theme-mode-control:hover:not(:disabled) .theme-mode-control__icon {
  color: var(--accent);
  opacity: 1;
}

.theme-mode-control:disabled {
  cursor: default;
}
</style>
