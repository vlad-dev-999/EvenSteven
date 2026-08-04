/** Curated Unicode crest library — premium hospitality-grade emoji only. */
export const CREST_OPTIONS = [
  // Houses
  { value: 'home',          label: '🏠' },
  { value: 'house2',        label: '🏡' },
  { value: 'pillar',        label: '🏛️' },
  { value: 'hut',           label: '🛖' },
  // Nature
  { value: 'herb',          label: '🌿' },
  { value: 'leaf',          label: '🍃' },
  { value: 'tree',          label: '🌲' },
  { value: 'oak',           label: '🌳' },
  { value: 'palm',          label: '🌴' },
  { value: 'cactus',        label: '🌵' },
  { value: 'autumn',        label: '🍂' },
  { value: 'hibiscus',      label: '🌺' },
  { value: 'blossom',       label: '🌸' },
  { value: 'sunflower',     label: '🌼' },
  // Ocean
  { value: 'wave',          label: '🌊' },
  { value: 'anchor',        label: '⚓' },
  { value: 'shell',         label: '🐚' },
  { value: 'dolphin',       label: '🐬' },
  { value: 'whale',         label: '🐋' },
  { value: 'turtle',        label: '🐢' },
  { value: 'crab',          label: '🦀' },
  // Sky
  { value: 'sun',           label: '☀️' },
  { value: 'cloud-sun',     label: '🌤️' },
  { value: 'partly-cloudy', label: '🌥️' },
  { value: 'moon',          label: '🌙' },
  { value: 'star',          label: '⭐' },
  { value: 'sparkle',       label: '✨' },
  { value: 'cloud',         label: '☁️' },
  { value: 'rainbow',       label: '🌈' },
  // Land
  { value: 'mountain',      label: '⛰️' },
  { value: 'peak',          label: '🏔️' },
  { value: 'rock',          label: '🪨' },
  // Warmth
  { value: 'flame',         label: '🔥' },
  { value: 'candle',        label: '🕯️' },
  { value: 'coffee',        label: '☕' },
  { value: 'wine',          label: '🍷' },
  { value: 'beer',          label: '🍺' },
  // Animals
  { value: 'fox',           label: '🦊' },
  { value: 'owl',           label: '🦉' },
  { value: 'deer',          label: '🦌' },
  { value: 'wolf',          label: '🐺' },
  { value: 'eagle',         label: '🦅' },
  { value: 'penguin',       label: '🐧' },
  { value: 'swan',          label: '🦢' },
  { value: 'otter',         label: '🦦' },
  { value: 'squirrel',      label: '🐿️' },
  // Prestige
  { value: 'fleur',         label: '⚜️' },
  { value: 'compass',       label: '🧭' },
  { value: 'shield',        label: '🛡️' },
  { value: 'crown',         label: '👑' },
  { value: 'gem',           label: '💎' },
  { value: 'tophat',        label: '🎩' },
  { value: 'target',        label: '🎯' },
];

/** Returns the emoji label for a crest value, falling back to 🏠. */
export function getCrestEmoji(crest: string): string {
  return CREST_OPTIONS.find(c => c.value === crest)?.label ?? '🏠';
}
