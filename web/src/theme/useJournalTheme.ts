// @env browser

import { useColorMode } from '@vueuse/core';
import { computed, nextTick, onScopeDispose, readonly, shallowRef } from 'vue';
import {
  THEME_PAGE_COLORS,
  THEME_REDUCED_MOTION_QUERY,
  THEME_STORAGE_KEY,
  THEME_TRANSITION_DURATION,
  THEME_TRANSITION_EASING,
} from './constants';
import type { ResolvedTheme, ThemeMode, ThemeOrigin, ThemeOriginResolver } from './types';

type ApplyResolvedTheme = (theme: ResolvedTheme) => void;

function syncThemeMetadata(theme: ResolvedTheme): void {
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = THEME_PAGE_COLORS[theme];
}

function calculateRevealClipPath(origin: ThemeOrigin): [string, string] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const radius = Math.hypot(
    Math.max(origin.x, width - origin.x),
    Math.max(origin.y, height - origin.y),
  );
  const radiusReference = Math.hypot(width, height) / Math.SQRT2;
  const x = (origin.x / width) * 100;
  const y = (origin.y / height) * 100;
  const radiusPercent = (radius / radiusReference) * 100;

  return [
    `circle(0% at ${x}% ${y}%)`,
    `circle(${radiusPercent}% at ${x}% ${y}%)`,
  ];
}

export function useJournalTheme(resolveDefaultOrigin: ThemeOriginResolver) {
  const transitioning = shallowRef(false);
  let pendingOrigin: ThemeOrigin | null = null;
  let revealAnimation: Animation | null = null;
  let disposed = false;

  function commitTheme(theme: ResolvedTheme, applyTheme: ApplyResolvedTheme): void {
    applyTheme(theme);
    syncThemeMetadata(theme);
  }

  function applyResolvedTheme(theme: ResolvedTheme, applyTheme: ApplyResolvedTheme): void {
    if (document.documentElement.dataset.theme === theme) {
      commitTheme(theme, applyTheme);
      pendingOrigin = null;
      transitioning.value = false;
      return;
    }

    if (window.matchMedia(THEME_REDUCED_MOTION_QUERY).matches) {
      commitTheme(theme, applyTheme);
      pendingOrigin = null;
      transitioning.value = false;
      return;
    }

    const origin = pendingOrigin ?? resolveDefaultOrigin();
    const clipPath = calculateRevealClipPath(origin);
    pendingOrigin = null;
    transitioning.value = true;

    const transition = document.startViewTransition(async () => {
      commitTheme(theme, applyTheme);
      await nextTick();
    });

    void transition.ready.then(() => {
      if (disposed) return;

      revealAnimation = document.documentElement.animate(
        {
          clipPath: theme === 'dark' ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: THEME_TRANSITION_DURATION,
          easing: THEME_TRANSITION_EASING,
          fill: 'forwards',
          pseudoElement: theme === 'dark'
            ? '::view-transition-old(root)'
            : '::view-transition-new(root)',
        },
      );
    });

    void transition.finished.then(() => {
      revealAnimation?.cancel();
      revealAnimation = null;
      transitioning.value = false;
    });
  }

  const mode = useColorMode({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: THEME_STORAGE_KEY,
    initialValue: 'auto',
    disableTransition: false,
    onChanged(theme, defaultHandler) {
      applyResolvedTheme(theme, defaultHandler);
    },
  });
  const storedMode = computed<ThemeMode>(() => mode.store.value);
  const resolvedTheme = computed<ResolvedTheme>(() => mode.state.value);

  function selectMode(nextMode: ThemeMode, origin: ThemeOrigin): void {
    if (transitioning.value || storedMode.value === nextMode) return;

    const nextTheme = nextMode === 'auto' ? mode.system.value : nextMode;
    if (nextTheme !== resolvedTheme.value) {
      pendingOrigin = origin;
      transitioning.value = true;
    }
    mode.store.value = nextMode;
  }

  onScopeDispose(() => {
    disposed = true;
    revealAnimation?.cancel();
    revealAnimation = null;
  });

  return {
    storedMode,
    resolvedTheme,
    transitioning: readonly(transitioning),
    selectMode,
  };
}
