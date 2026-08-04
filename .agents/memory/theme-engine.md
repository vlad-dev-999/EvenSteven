---
name: Theme engine
description: How the dynamic theming system works — tokens, files, and extension pattern.
---

## Architecture

All theming is CSS-variable-only. Components are never touched.

- `src/themes/index.ts` — theme registry (THEMES array, types, localStorage load/save, seasonal logic)
- `src/themes/weather.ts` — ip-api + open-meteo weather fetch (no API key); 30-min localStorage cache
- `src/themes/context.tsx` — ThemeProvider wraps App; useThemeContext() used by AppearanceSection
- `src/index.css` — theme blocks as `[data-theme="name"] { --token: value; ... }` + decorative effects
- Applied via `document.documentElement.dataset.theme`; Classic = attribute removed

## Appearance UI

Lives in Steward's Desk → Settings tab (top section, above Skipper's Note). Component: `AppearanceSection` in `console.tsx`.

## Adding a new theme

1. Add its key to `THEMES` array in `src/themes/index.ts`
2. Add its label to `THEME_LABELS`
3. Add a `[data-theme="key"] { ... }` block to `src/index.css`

No React changes required.

## Storage

`localStorage` key: `evensteven-theme-v1` → `{ mode, manualTheme }`
Weather cache key: `evensteven-weather-v1` → `{ category, ts }` (30-min TTL)

## Low-power devices

`isLowPower()` adds `html.reduce-effects` on mount; CSS uses that class to disable all decorative animations.

**Why:** Decorative effects (snow, stars, rain) are GPU-friendly but still unnecessary on budget devices.
