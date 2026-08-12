import type { ResolvedTheme, ThemeMode } from './types';

export const THEME_STORAGE_KEY = 'notinews-theme-mode';
export const THEME_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const THEME_TRANSITION_DURATION = 400;
export const THEME_TRANSITION_EASING = 'ease-out';

export const THEME_PAGE_COLORS: Record<ResolvedTheme, string> = {
  light: '#f7f7f5',
  dark: '#1d1d1b',
};

export const THEME_MODE_NAMES: Record<ThemeMode, string> = {
  light: '亮色模式',
  dark: '暗色模式',
  auto: '跟随系统',
};

export const THEME_MODE_CYCLE = ['light', 'dark', 'auto'] as const satisfies readonly ThemeMode[];
