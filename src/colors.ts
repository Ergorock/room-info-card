import type { ColorValue, ComfortConfig, LuminanceConfig } from './config';

export type ComfortLevel = 'cold' | 'comfort' | 'hot';
export type LuminanceLevel = 'dark' | 'cloudy' | 'bright';

export const LUMINANCE_BADGE: Record<LuminanceLevel, { emoji: string; background: string }> = {
  dark: { emoji: '🌑', background: '#007bff' },
  cloudy: { emoji: '⛅', background: '#28a745' },
  bright: { emoji: '☀️', background: '#ffc107' },
};

const HA_COLORS = new Set([
  'primary', 'accent', 'disabled', 'red', 'pink', 'purple', 'deep-purple', 'indigo', 'blue',
  'light-blue', 'cyan', 'teal', 'green', 'light-green', 'lime', 'yellow', 'amber', 'orange',
  'deep-orange', 'brown', 'grey', 'blue-grey', 'black', 'white',
]);

export function comfortLevel(value: number, c: ComfortConfig): ComfortLevel {
  if (value < c.cold_below) return 'cold';
  if (value > c.hot_above) return 'hot';
  return 'comfort';
}

export function luminanceLevel(lux: number, l: LuminanceConfig): LuminanceLevel {
  if (lux < l.dark_below) return 'dark';
  if (lux > l.bright_above) return 'bright';
  return 'cloudy';
}

export function resolveColor(color: ColorValue | null | undefined): string | undefined {
  if (Array.isArray(color)) return `rgb(${color.join(', ')})`;
  if (!color) return undefined;
  return HA_COLORS.has(color) ? `var(--${color}-color)` : color;
}

export function parseNumber(state: string | undefined): number | null {
  if (state === undefined || state.trim() === '') return null;
  const n = Number(state);
  return Number.isFinite(n) ? n : null;
}
