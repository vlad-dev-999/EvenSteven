import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Theme, ThemeSettings } from './index';
import {
  loadThemeSettings,
  saveThemeSettings,
  getSeasonalTheme,
  applyThemeToDOM,
  isLowPower,
} from './index';
import { fetchWeatherCategory, weatherToTheme } from './weather';

// ─── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  settings:       ThemeSettings;
  resolvedTheme:  Theme;
  weatherLoading: boolean;
  updateSettings: (next: ThemeSettings) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings]           = useState<ThemeSettings>(loadThemeSettings);
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('classic');
  const [weatherLoading, setWeatherLoading] = useState(false);
  // Guard against double-fetch in React StrictMode double-effect invocations
  const fetchingWeather = useRef(false);

  // Mark low-power devices so CSS decorative effects can self-disable
  useEffect(() => {
    if (isLowPower()) {
      document.documentElement.classList.add('reduce-effects');
    }
  }, []);

  // Resolve and apply theme whenever settings change
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      switch (settings.mode) {

        case 'classic':
          if (!cancelled) { setResolvedTheme('classic'); applyThemeToDOM('classic'); }
          break;

        case 'seasonal': {
          const theme = getSeasonalTheme();
          if (!cancelled) { setResolvedTheme(theme); applyThemeToDOM(theme); }
          break;
        }

        case 'weather': {
          if (fetchingWeather.current) break;
          fetchingWeather.current = true;
          setWeatherLoading(true);
          try {
            const category = await fetchWeatherCategory();
            const theme    = weatherToTheme(category);
            if (!cancelled) { setResolvedTheme(theme); applyThemeToDOM(theme); }
          } catch {
            // Graceful fallback — network failure → Classic
            if (!cancelled) { setResolvedTheme('classic'); applyThemeToDOM('classic'); }
          } finally {
            fetchingWeather.current = false;
            if (!cancelled) setWeatherLoading(false);
          }
          break;
        }

        case 'manual': {
          const theme = settings.manualTheme;
          if (!cancelled) { setResolvedTheme(theme); applyThemeToDOM(theme); }
          break;
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [settings]);

  const updateSettings = useCallback((next: ThemeSettings) => {
    // Reset weather fetch guard whenever mode switches to weather
    if (next.mode === 'weather' && settings.mode !== 'weather') {
      fetchingWeather.current = false;
    }
    saveThemeSettings(next);
    setSettings(next);
  }, [settings.mode]);

  return (
    <ThemeContext.Provider value={{ settings, resolvedTheme, weatherLoading, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Consumer hook ─────────────────────────────────────────────────────────────

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within <ThemeProvider>');
  return ctx;
}
