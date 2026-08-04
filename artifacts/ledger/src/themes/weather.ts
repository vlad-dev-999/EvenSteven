import type { Theme } from './index';

// ─── Weather → Theme mapping ────────────────────────────────────────────────────
// Uses ip-api.com (free, no key) for geolocation and
// Open-Meteo (free, no key) for WMO weather codes.

export type WeatherCategory = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow';

const CACHE_KEY  = 'evensteven-weather-v1';
const CACHE_TTL  = 30 * 60 * 1000; // 30 minutes

interface WeatherCache {
  category: WeatherCategory;
  ts: number;
}

function readCache(): WeatherCategory | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as WeatherCache;
    if (Date.now() - c.ts > CACHE_TTL) return null;
    return c.category;
  } catch { return null; }
}

function writeCache(category: WeatherCategory): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ category, ts: Date.now() }));
}

/** WMO weather interpretation code → broad category */
function wmoToCategory(code: number): WeatherCategory {
  if (code <= 1)  return 'sunny';
  if (code <= 3)  return 'cloudy';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}

/**
 * Returns the current weather category for the visitor's approximate location.
 * Results are cached in localStorage for 30 minutes.
 * Throws on network failure — callers should fall back to 'classic'.
 */
export async function fetchWeatherCategory(): Promise<WeatherCategory> {
  const cached = readCache();
  if (cached) return cached;

  const timeout = (ms: number) =>
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(ms)
      : undefined;

  // Step 1: rough geolocation via ip-api
  const geoRes = await fetch(
    'https://ip-api.com/json/?fields=lat,lon,status',
    { signal: timeout(5000) as AbortSignal | undefined },
  );
  if (!geoRes.ok) throw new Error('geo request failed');
  const geo = await geoRes.json() as { status: string; lat: number; lon: number };
  if (geo.status !== 'success') throw new Error('geo lookup failed');

  // Step 2: current weather code via Open-Meteo
  const meteoUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${geo.lat}&longitude=${geo.lon}` +
    `&current=weather_code&forecast_days=1`;

  const meteoRes = await fetch(meteoUrl, { signal: timeout(5000) as AbortSignal | undefined });
  if (!meteoRes.ok) throw new Error('meteo request failed');
  const meteo = await meteoRes.json() as { current?: { weather_code?: number } };
  const code  = meteo.current?.weather_code ?? 0;

  const category = wmoToCategory(code);
  writeCache(category);
  return category;
}

/** Maps a weather category to the most fitting EvenSteven theme. */
export function weatherToTheme(category: WeatherCategory): Theme {
  const map: Record<WeatherCategory, Theme> = {
    sunny:  'summer',
    cloudy: 'nautical',
    rain:   'rain',
    storm:  'storm',
    snow:   'christmas',
  };
  return map[category];
}
