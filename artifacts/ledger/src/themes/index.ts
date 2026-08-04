// ─── Theme Registry ────────────────────────────────────────────────────────────
// Adding a new theme = add its key here + a CSS block in index.css.
// No React component changes required.

export const THEMES = [
  'classic',
  'nautical',
  'spring',
  'summer',
  'autumn',
  'christmas',
  'rain',
  'storm',
  'night-sky',
] as const;

export type Theme = (typeof THEMES)[number];

export type ThemeMode = 'classic' | 'seasonal' | 'weather' | 'manual';

export interface ThemeSettings {
  mode: ThemeMode;
  manualTheme: Theme;
}

export const THEME_LABELS: Record<Theme, string> = {
  classic:    'Classic',
  nautical:   'Nautical',
  spring:     'Spring',
  summer:     'Summer',
  autumn:     'Autumn',
  christmas:  'Christmas',
  rain:       'Rain',
  storm:      'Storm',
  'night-sky':'Night Sky',
};

export const MODE_LABELS: Record<ThemeMode, string> = {
  classic:  'Classic',
  seasonal: 'Seasonal',
  weather:  'Weather',
  manual:   'Manual',
};

export const MODE_DESCRIPTIONS: Record<ThemeMode, string> = {
  classic:  'Always the warm parchment palette.',
  seasonal: 'Automatically follows the season.',
  weather:  'Adapts to your local weather.',
  manual:   'You choose the look.',
};

const STORAGE_KEY = 'evensteven-theme-v1';

export const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'classic',
  manualTheme: 'classic',
};

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      return {
        mode: parsed.mode ?? DEFAULT_SETTINGS.mode,
        manualTheme: parsed.manualTheme ?? DEFAULT_SETTINGS.manualTheme,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveThemeSettings(settings: ThemeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Resolves which theme the Seasonal mode should show for the current month. */
export function getSeasonalTheme(): Theme {
  const month = new Date().getMonth(); // 0 = Jan … 11 = Dec
  if (month === 11 || month <= 1) return 'christmas'; // Dec – Feb
  if (month <= 4)                 return 'spring';    // Mar – May
  if (month <= 7)                 return 'summer';    // Jun – Aug
  return 'autumn';                                     // Sep – Nov
}

/** Applies or removes the data-theme attribute on <html>. */
export function applyThemeToDOM(theme: Theme): void {
  if (theme === 'classic') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

/** Detect low-power devices; decorative effects are disabled for them. */
export function isLowPower(): boolean {
  return typeof navigator !== 'undefined' &&
    'hardwareConcurrency' in navigator &&
    navigator.hardwareConcurrency <= 2;
}
