import { html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LUMINANCE_DEFAULTS, pruneDefaults, withDefaults, type UserConfig } from './config';
import { localize } from './localize';
import type { HomeAssistant } from './types';

// Subset of HA's ha-form schema; `label_key` is ours, read back in computeLabel.
export interface HaFormSchema {
  name: string;
  type?: 'expandable';
  title?: string;
  flatten?: boolean;
  expanded?: boolean;
  label_key?: string;
  selector?: Record<string, unknown>;
  schema?: HaFormSchema[];
}

const field = (name: string, label_key: string, selector: Record<string, unknown>): HaFormSchema => ({
  name,
  label_key,
  selector,
});

const num = (min: number, max: number, step: number, mode: 'box' | 'slider' = 'box', unit?: string) => ({
  number: { min, max, step, mode, ...(unit ? { unit_of_measurement: unit } : {}) },
});

const select = (prefix: string, values: string[], lang: string) => ({
  select: { mode: 'dropdown', options: values.map((v) => ({ value: v, label: localize(`${prefix}.${v}`, lang) })) },
});

const panel = (name: string, lang: string, schema: HaFormSchema[], extra: Partial<HaFormSchema> = {}): HaFormSchema => ({
  name,
  type: 'expandable',
  title: localize(`panel.${name}`, lang),
  schema,
  ...extra,
});

export function buildSchema(config: UserConfig, lang = 'en'): HaFormSchema[] {
  const colorKeys = ['cold', 'comfort', 'hot', 'trend_up', 'trend_down', 'trend_stable'];
  const style: HaFormSchema[] = [
    field('background', 'style.background', select('background', ['glass', 'solid', 'none'], lang)),
    field('tint', 'style.tint', select('tint', ['none', 'temperature', 'custom'], lang)),
    ...(config.style?.tint === 'custom' ? [field('tint_color', 'style.tint_color', { color_rgb: {} })] : []),
    field('tint_opacity', 'style.tint_opacity', num(0, 1, 0.05, 'slider')),
    field('opacity', 'style.opacity', num(0, 1, 0.05, 'slider')),
    field('blur', 'style.blur', num(0, 30, 1, 'slider', 'px')),
    field('radius', 'style.radius', num(0, 32, 1, 'slider', 'px')),
    field('font_size', 'style.font_size', num(8, 24, 1, 'slider', 'px')),
    field('icon_size', 'style.icon_size', num(24, 64, 1, 'slider', 'px')),
    panel('colors', lang, colorKeys.map((k) => field(k, `style.colors.${k}`, { ui_color: {} }))),
  ];

  return [
    panel(
      'general',
      lang,
      [
        field('entity', 'entity', { entity: { domain: 'sensor', device_class: 'temperature' } }),
        field('name', 'name', { text: {} }),
        field('icon', 'icon', { icon: {} }),
        field('decimals', 'decimals', num(0, 2, 1)),
        field('tap_action', 'tap_action', { ui_action: {} }),
      ],
      { flatten: true, expanded: true },
    ),
    panel('trend', lang, [
      field('enabled', 'trend.enabled', { boolean: {} }),
      field('window', 'trend.window', num(5, 240, 5, 'box', 'min')),
      field('stable_threshold', 'trend.stable_threshold', num(0, 2, 0.1, 'box', '°')),
      field('show_stable', 'trend.show_stable', { boolean: {} }),
    ]),
    panel('comfort', lang, [
      field('cold_below', 'comfort.cold_below', num(-30, 50, 0.5, 'box', '°')),
      field('hot_above', 'comfort.hot_above', num(-30, 50, 0.5, 'box', '°')),
    ]),
    panel('luminance', lang, [
      field('entity', 'luminance.entity', { entity: { domain: 'sensor', device_class: 'illuminance' } }),
      field('dark_below', 'luminance.dark_below', num(0, 200000, 100, 'box', 'lx')),
      field('bright_above', 'luminance.bright_above', num(0, 200000, 100, 'box', 'lx')),
    ]),
    panel('style', lang, style),
  ];
}

export class RoomInfoCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: UserConfig;

  setConfig(config: UserConfig): void {
    // HA echoes back the pruned config we emitted; keep our unpruned copy so
    // threshold-only edits (e.g. luminance without entity yet) are not lost.
    if (this._config && JSON.stringify(pruneDefaults(this._config)) === JSON.stringify(config)) return;
    this._config = config;
  }

  private get _lang(): string {
    return this.hass?.locale?.language ?? 'en';
  }

  private _computeLabel = (schema: HaFormSchema) => localize(schema.label_key ?? schema.name, this._lang);

  private _valueChanged(ev: CustomEvent<{ value: UserConfig }>): void {
    ev.stopPropagation();
    const raw = { ...ev.detail.value, type: this._config?.type ?? ev.detail.value.type };
    const config = pruneDefaults(raw);
    this._config = raw;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this._config) return nothing;
    const data = {
      ...withDefaults(this._config),
      entity: this._config.entity ?? '',
      luminance: { ...LUMINANCE_DEFAULTS, ...this._config.luminance },
    };
    return html`<ha-form
      .hass=${this.hass}
      .data=${data}
      .schema=${buildSchema(this._config, this._lang)}
      .computeLabel=${this._computeLabel}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }
}

if (!customElements.get('room-info-card-editor')) {
  customElements.define('room-info-card-editor', RoomInfoCardEditor);
}
