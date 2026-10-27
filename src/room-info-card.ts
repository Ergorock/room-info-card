import { html, LitElement, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { comfortLevel, LUMINANCE_BADGE, luminanceLevel, parseNumber, resolveColor } from './colors';
import { mergeConfig, type RoomInfoCardConfig, type UserConfig } from './config';
import './editor';
import { fetchHistory } from './history';
import { cardStyles } from './styles';
import { addPoint, computeTrend, prune, type Point, type Trend } from './trend';
import type { HomeAssistant } from './types';

const TICK_MS = 60_000;
const TREND_ICONS: Record<Trend, string> = {
  up: 'mdi:arrow-top-right-thick',
  down: 'mdi:arrow-bottom-right-thick',
  stable: 'mdi:arrow-right-bold',
};
const TREND_COLOR_KEY = { up: 'trend_up', down: 'trend_down', stable: 'trend_stable' } as const;

function mergePoints(a: Point[], b: Point[]): Point[] {
  const byTime = new Map<number, Point>();
  for (const p of [...a, ...b]) byTime.set(p.t, p);
  return [...byTime.values()].sort((x, y) => x.t - y.t);
}

export class RoomInfoCard extends LitElement {
  static styles = cardStyles;

  @state() protected _config?: RoomInfoCardConfig;
  @state() protected _trend: Trend | null = null;
  protected _hass?: HomeAssistant;
  protected _points: Point[] = [];
  protected _timer?: ReturnType<typeof setInterval>;
  private _reqId = 0;
  private _loadedFor?: string;
  private _lastUpdated?: string;
  private _detached = false;
  private _onReady = () => this._load();

  static getConfigElement(): HTMLElement {
    return document.createElement('room-info-card-editor');
  }

  static getStubConfig(hass: HomeAssistant): { entity: string } {
    const sensor = Object.values(hass.states).find(
      (s) => s.entity_id.startsWith('sensor.') && s.attributes?.device_class === 'temperature',
    );
    return { entity: sensor?.entity_id ?? '' };
  }

  setConfig(config: UserConfig): void {
    const merged = mergeConfig(config);
    if (this._loadKey(merged) !== this._loadedFor) {
      this._points = [];
      this._trend = null;
      this._lastUpdated = undefined;
      this._loadedFor = undefined;
      this._reqId++;
    }
    this._config = merged;
    if (this._hass) {
      if (this._loadedFor === undefined) this._load();
      this._ingest();
    }
  }

  set hass(hass: HomeAssistant) {
    const first = !this._hass;
    this._hass = hass;
    if (first) hass.connection?.addEventListener('ready', this._onReady);
    if (this._config && this._loadedFor === undefined) this._load();
    this._ingest();
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions() {
    return { columns: 3, rows: 2, min_columns: 2, min_rows: 2 };
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), TICK_MS);
    if (this._detached && this._hass) {
      this._hass.connection?.addEventListener('ready', this._onReady);
      this._load();
    }
    this._detached = false;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) clearInterval(this._timer);
    this._timer = undefined;
    this._hass?.connection?.removeEventListener('ready', this._onReady);
    this._detached = true;
  }

  private _loadKey(c: RoomInfoCardConfig): string {
    return `${c.entity}|${c.trend.enabled}|${c.trend.window}`;
  }

  private _windowMs(): number {
    return (this._config?.trend.window ?? 0) * 60_000;
  }

  private async _load(): Promise<void> {
    const config = this._config;
    const hass = this._hass;
    if (!config || !hass) return;
    this._loadedFor = this._loadKey(config);
    if (!config.trend.enabled) return;
    const id = ++this._reqId;
    const points = await fetchHistory(hass, config.entity, this._windowMs());
    if (id !== this._reqId) return;
    this._points = prune(mergePoints(points, this._points), Date.now(), this._windowMs());
    this._recompute();
  }

  private _ingest(): void {
    const config = this._config;
    const entity = config && this._hass?.states[config.entity];
    if (!config?.trend.enabled || !entity || entity.last_updated === this._lastUpdated) return;
    this._lastUpdated = entity.last_updated;
    const v = parseNumber(entity.state);
    const t = Date.parse(entity.last_updated);
    if (v === null || Number.isNaN(t)) return;
    this._points = addPoint(this._points, { t, v });
    this._recompute();
  }

  private _tick(): void {
    if (!this._config?.trend.enabled) return;
    this._points = prune(this._points, Date.now(), this._windowMs());
    this._recompute();
  }

  private _recompute(): void {
    const c = this._config;
    this._trend = c ? computeTrend(this._points, Date.now(), this._windowMs(), c.trend.stable_threshold) : null;
  }

  private _handleTap(): void {
    const c = this._config;
    if (!c) return;
    this.dispatchEvent(
      new CustomEvent('hass-action', {
        bubbles: true,
        composed: true,
        detail: { config: { entity: c.entity, tap_action: c.tap_action }, action: 'tap' },
      }),
    );
  }

  private _handleKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this._handleTap();
    }
  }

  protected render() {
    const c = this._config;
    if (!c || !this._hass) return nothing;
    const entity = this._hass.states[c.entity];
    const value = parseNumber(entity?.state);
    const available = value !== null;
    const level = available ? comfortLevel(value, c.comfort) : null;
    const color = level ? resolveColor(c.style.colors[level]) : undefined;

    const tint =
      c.style.tint === 'temperature' ? color : c.style.tint === 'custom' ? resolveColor(c.style.tint_color) : undefined;

    const cardStyle: Record<string, string> = {
      '--ric-radius': `${c.style.radius}px`,
      '--ric-blur': `${c.style.blur}px`,
      '--ric-opacity': String(c.style.opacity),
      '--ric-font-size': `${c.style.font_size}px`,
      '--ric-icon-size': `${c.style.icon_size}px`,
      '--ric-tint-opacity': String(c.style.tint_opacity),
    };
    if (tint) cardStyle['--ric-tint'] = tint;

    const name = c.name ?? entity?.attributes.friendly_name ?? c.entity;
    const icon = c.icon ?? entity?.attributes.icon ?? 'mdi:thermometer';
    const temp = available ? `${value.toFixed(c.decimals)}°` : '—';

    return html`
      <ha-card
        class=${classMap({ [c.style.background]: true, tinted: !!tint })}
        style=${styleMap(cardStyle)}
        tabindex="0"
        role="button"
        @click=${this._handleTap}
        @keydown=${this._handleKey}
      >
        <div class=${classMap({ 'icon-wrap': true, unavailable: !available })} style=${styleMap(color ? { '--ric-color': color } : {})}>
          <ha-icon .icon=${icon}></ha-icon>
          ${this._renderLux()} ${available ? this._renderTrend() : nothing}
        </div>
        <div class="temp">${temp}</div>
        <div class="name">${name}</div>
      </ha-card>
    `;
  }

  private _renderTrend() {
    const c = this._config!;
    const trend = this._trend;
    if (!c.trend.enabled || !trend || (trend === 'stable' && !c.trend.show_stable)) return nothing;
    const bg = resolveColor(c.style.colors[TREND_COLOR_KEY[trend]]) ?? 'grey';
    return html`<div class="badge trend" style=${styleMap({ background: bg })}>
      <ha-icon .icon=${TREND_ICONS[trend]}></ha-icon>
    </div>`;
  }

  private _renderLux() {
    const l = this._config!.luminance;
    if (!l?.entity) return nothing;
    const lux = parseNumber(this._hass!.states[l.entity]?.state);
    if (lux === null) return nothing;
    const badge = LUMINANCE_BADGE[luminanceLevel(lux, l)];
    return html`<div class="badge lux" style=${styleMap({ background: badge.background })}>${badge.emoji}</div>`;
  }
}

if (!customElements.get('room-info-card')) {
  customElements.define('room-info-card', RoomInfoCard);
}

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
  interface HTMLElementTagNameMap {
    'room-info-card': RoomInfoCard;
  }
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'room-info-card')) {
  window.customCards.push({
    type: 'room-info-card',
    name: 'Room Info Card',
    description: "Température, tendance et confort d'une pièce",
    preview: true,
  });
}
