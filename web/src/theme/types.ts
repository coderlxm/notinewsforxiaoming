export type ThemeMode = 'light' | 'dark' | 'auto';

export type ResolvedTheme = Exclude<ThemeMode, 'auto'>;

export interface ThemeOrigin {
  x: number;
  y: number;
}

export type ThemeOriginResolver = () => ThemeOrigin;
