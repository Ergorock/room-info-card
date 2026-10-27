import type { ActionConfig } from './types';

export type Background = 'glass' | 'solid' | 'none';
export type Tint = 'none' | 'temperature' | 'custom';
export type ColorValue = string | [number, number, number];

export interface TrendConfig {
  enabled: boolean;
  window: number;
  stable_threshold: number;
  show_stable: boolean;
}

export interface ComfortConfig {
  cold_below: number;
  hot_above: number;
}

export interface LuminanceConfig {
  entity: string;
  dark_below: number;
  bright_above: number;
}

export interface StyleColors {
  cold: ColorValue;
  comfort: ColorValue;
  hot: ColorValue;
  trend_up: ColorValue;
  trend_down: ColorValue;
  trend_stable: ColorValue;
}

export interface StyleConfig {
  background: Background;
  tint: Tint;
  tint_color: ColorValue | null;
  tint_opacity: number;
  blur: number;
  opacity: number;
  radius: number;
  font_size: number;
  icon_size: number;
  colors: StyleColors;
}

export interface RoomInfoCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  decimals: number;
  tap_action: ActionConfig;
  trend: TrendConfig;
  comfort: ComfortConfig;
  luminance?: LuminanceConfig;
  style: StyleConfig;
}

export interface UserConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  decimals?: number;
  tap_action?: ActionConfig;
  trend?: Partial<TrendConfig>;
  comfort?: Partial<ComfortConfig>;
  luminance?: Partial<LuminanceConfig>;
  style?: Partial<Omit<StyleConfig, 'colors'>> & { colors?: Partial<StyleColors> };
}

export const LUMINANCE_DEFAULTS = { dark_below: 5000, bright_above: 20000 };

export const DEFAULTS = {
  decimals: 1,
  tap_action: { action: 'more-info' } as ActionConfig,
  trend: { enabled: true, window: 30, stable_threshold: 0.2, show_stable: true } as TrendConfig,
  comfort: { cold_below: 19, hot_above: 22 } as ComfortConfig,
  style: {
    background: 'glass',
    tint: 'none',
    tint_color: null,
    tint_opacity: 0.25,
    blur: 14,
    opacity: 0.35,
    radius: 16,
    font_size: 10,
    icon_size: 36,
    colors: {
      cold: 'blue',
      comfort: 'green',
      hot: 'red',
      trend_up: 'orange',
      trend_down: 'blue',
      trend_stable: 'green',
    },
  } as StyleConfig,
};

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function deepMerge(base: any, over: any): any {
  if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
  const out: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObject(base[k]) && isObject(v) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function mergeConfig(user: UserConfig): RoomInfoCardConfig {
  if (!user || typeof user.entity !== 'string' || user.entity === '') {
    throw new Error('room-info-card: "entity" is required');
  }
  return withDefaults(user);
}

// Same as mergeConfig without validation (used by the editor while entity is still empty).
export function withDefaults(user: UserConfig): RoomInfoCardConfig {
  const { luminance, ...rest } = user;
  const merged = deepMerge(DEFAULTS, rest) as RoomInfoCardConfig;
  if (luminance) merged.luminance = deepMerge(LUMINANCE_DEFAULTS, luminance);
  return merged;
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function prune(value: any, defaults: any): any {
  if (!isObject(value)) return value;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const d = isObject(defaults) ? defaults[k] : undefined;
    if (d !== undefined && isEqual(v, d)) continue;
    const p = isObject(v) ? prune(v, d) : v;
    if (isObject(p) && Object.keys(p).length === 0) continue;
    out[k] = p;
  }
  return out;
}

export function pruneDefaults(config: UserConfig): UserConfig {
  const { type, entity, luminance, ...rest } = config;
  const out: UserConfig = { type, entity, ...prune(rest, DEFAULTS) };
  if (luminance?.entity) out.luminance = { entity: luminance.entity, ...prune(luminance, LUMINANCE_DEFAULTS) };
  return out;
}
