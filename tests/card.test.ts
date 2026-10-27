import { fetchHistory } from '../src/history';
import '../src/room-info-card';
import type { RoomInfoCard } from '../src/room-info-card';
import type { UserConfig } from '../src/config';

vi.mock('../src/history', () => ({ fetchHistory: vi.fn() }));
const fetchMock = vi.mocked(fetchHistory);

const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const MIN = 60_000;
const iso = (t: number) => new Date(t).toISOString();

type States = Record<string, { state: string; last_updated?: string; attributes?: Record<string, any> }>;

function makeHass(states: States) {
  const full: Record<string, any> = {};
  for (const [id, s] of Object.entries(states)) {
    full[id] = { entity_id: id, attributes: {}, last_updated: iso(NOW - MIN), ...s };
  }
  return {
    states: full,
    locale: { language: 'fr' },
    callWS: vi.fn(),
    connection: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  } as any;
}

async function mount(config: Partial<UserConfig>, states: States): Promise<RoomInfoCard> {
  const card = document.createElement('room-info-card') as RoomInfoCard;
  document.body.appendChild(card);
  card.setConfig({ type: 'custom:room-info-card', entity: 'sensor.t', ...config } as UserConfig);
  card.hass = makeHass(states);
  await flush(card);
  return card;
}

async function flush(card: RoomInfoCard) {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await card.updateComplete;
}

const $ = (card: RoomInfoCard, sel: string) => card.shadowRoot!.querySelector(sel) as HTMLElement | null;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['setInterval', 'clearInterval', 'Date'] });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue([]);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('room-info-card', () => {
  it('renders temperature, name and icon', async () => {
    const card = await mount({ name: 'Antoine', icon: 'mdi:face-man' }, { 'sensor.t': { state: '19.74' } });
    expect($(card, '.temp')!.textContent!.trim()).toBe('19.7°');
    expect($(card, '.name')!.textContent!.trim()).toBe('Antoine');
    expect(($(card, '.icon-wrap ha-icon') as any).icon).toBe('mdi:face-man');
  });

  it('falls back to friendly_name and entity icon', async () => {
    const card = await mount({}, { 'sensor.t': { state: '20', attributes: { friendly_name: 'Salon', icon: 'mdi:sofa' } } });
    expect($(card, '.name')!.textContent!.trim()).toBe('Salon');
    expect(($(card, '.icon-wrap ha-icon') as any).icon).toBe('mdi:sofa');
  });

  it.each([['unavailable'], [''], [null]])('renders dash when unavailable (%s)', async (state) => {
    fetchMock.mockResolvedValue([{ t: NOW - 40 * MIN, v: 19 }, { t: NOW - MIN, v: 20 }]);
    const states: States = state === null ? {} : { 'sensor.t': { state } };
    const card = await mount({}, states);
    expect($(card, '.temp')!.textContent!.trim()).toBe('—');
    expect($(card, '.badge.trend')).toBeNull();
    expect($(card, '.icon-wrap')!.classList.contains('unavailable')).toBe(true);
  });

  it('shows trend up badge', async () => {
    fetchMock.mockResolvedValue([{ t: NOW - 40 * MIN, v: 19 }, { t: NOW - MIN, v: 19.6 }]);
    const card = await mount({}, { 'sensor.t': { state: '19.6' } });
    expect(($(card, '.badge.trend ha-icon') as any).icon).toBe('mdi:arrow-top-right-thick');
  });

  it('hides stable badge when show_stable false', async () => {
    fetchMock.mockResolvedValue([{ t: NOW - 40 * MIN, v: 19.5 }, { t: NOW - MIN, v: 19.6 }]);
    const shown = await mount({}, { 'sensor.t': { state: '19.6' } });
    expect(($(shown, '.badge.trend ha-icon') as any).icon).toBe('mdi:arrow-right-bold');
    const hidden = await mount({ trend: { show_stable: false } }, { 'sensor.t': { state: '19.6' } });
    expect($(hidden, '.badge.trend')).toBeNull();
  });

  it('does not fetch history when trend disabled', async () => {
    const card = await mount({ trend: { enabled: false } }, { 'sensor.t': { state: '19.6' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect($(card, '.badge.trend')).toBeNull();
  });

  it('appends live updates', async () => {
    fetchMock.mockResolvedValue([{ t: NOW - 40 * MIN, v: 19 }, { t: NOW - 2 * MIN, v: 19.2 }]);
    const card = await mount({}, { 'sensor.t': { state: '19.2', last_updated: iso(NOW - 2 * MIN) } });
    const before = (card as any)._points.length;
    card.hass = makeHass({ 'sensor.t': { state: '19.8', last_updated: iso(NOW) } });
    await flush(card);
    expect((card as any)._points.length).toBe(before + 1);
    expect(($(card, '.badge.trend ha-icon') as any).icon).toBe('mdi:arrow-top-right-thick');
  });

  it('restarts timer on reconnect', async () => {
    const card = await mount({}, { 'sensor.t': { state: '19.6' } });
    expect(vi.getTimerCount()).toBe(1);
    card.remove();
    expect(vi.getTimerCount()).toBe(0);
    document.body.appendChild(card);
    await flush(card);
    expect(vi.getTimerCount()).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores stale history response', async () => {
    let resolveFirst!: (v: any) => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    fetchMock.mockResolvedValueOnce([]);
    const card = await mount({}, { 'sensor.t': { state: '19.6' }, 'sensor.u': { state: '18' } });
    card.setConfig({ type: 'custom:room-info-card', entity: 'sensor.u' });
    await flush(card);
    resolveFirst([{ t: NOW - 40 * MIN, v: 10 }, { t: NOW - MIN, v: 19.6 }]);
    await flush(card);
    expect($(card, '.badge.trend')).toBeNull();
  });

  it('shows luminance badge', async () => {
    const card = await mount({ luminance: { entity: 'sensor.lux' } }, { 'sensor.t': { state: '20' }, 'sensor.lux': { state: '25000' } });
    expect($(card, '.badge.lux')!.textContent!.trim()).toBe('☀️');
  });

  it('hides luminance badge when lux unavailable', async () => {
    const card = await mount({ luminance: { entity: 'sensor.lux' } }, { 'sensor.t': { state: '20' }, 'sensor.lux': { state: 'unavailable' } });
    expect($(card, '.badge.lux')).toBeNull();
    expect($(card, '.temp')!.textContent!.trim()).toBe('20.0°');
  });

  it('applies custom tint colour', async () => {
    const card = await mount({ style: { tint: 'custom', tint_color: [192, 242, 189] } }, { 'sensor.t': { state: '13' } });
    expect($(card, 'ha-card')!.style.getPropertyValue('--ric-tint')).toBe('rgb(192, 242, 189)');
  });

  it('omits tint when custom colour missing', async () => {
    const card = await mount({ style: { tint: 'custom' } }, { 'sensor.t': { state: '13' } });
    expect($(card, 'ha-card')!.style.getPropertyValue('--ric-tint')).toBe('');
    expect($(card, 'ha-card')!.getAttribute('style')).not.toContain('undefined');
  });

  it('fires hass-action on tap', async () => {
    const card = await mount({}, { 'sensor.t': { state: '20' } });
    const listener = vi.fn();
    card.addEventListener('hass-action', listener);
    $(card, 'ha-card')!.click();
    const detail = listener.mock.calls[0][0].detail;
    expect(detail.action).toBe('tap');
    expect(detail.config.tap_action.action).toBe('more-info');
    expect(detail.config.entity).toBe('sensor.t');
  });

  it('throws on missing entity', () => {
    const card = document.createElement('room-info-card') as RoomInfoCard;
    expect(() => card.setConfig({ type: 't' } as any)).toThrow(/entity/);
  });

  it('exposes grid options and card size', () => {
    const card = document.createElement('room-info-card') as RoomInfoCard;
    expect(card.getCardSize()).toBe(2);
    expect(card.getGridOptions()).toEqual({ columns: 3, rows: 2, min_columns: 2, min_rows: 2 });
  });
});

describe('room-info-card updates', () => {
  it('applies a new stable_threshold immediately', async () => {
    fetchMock.mockResolvedValue([{ t: NOW - 40 * MIN, v: 19 }, { t: NOW - MIN, v: 19.6 }]);
    const card = await mount({}, { 'sensor.t': { state: '19.6', last_updated: iso(NOW - MIN) } });
    expect(($(card, '.badge.trend ha-icon') as any).icon).toBe('mdi:arrow-top-right-thick');
    card.setConfig({ type: 'custom:room-info-card', entity: 'sensor.t', trend: { stable_threshold: 1 } });
    await flush(card);
    expect(($(card, '.badge.trend ha-icon') as any).icon).toBe('mdi:arrow-right-bold');
  });

  it('skips re-render when only unrelated entities change', async () => {
    const card = await mount({ luminance: { entity: 'sensor.lux' } }, { 'sensor.t': { state: '20' }, 'sensor.lux': { state: '100' } });
    const prev = card.hass!;
    card.hass = { ...prev, states: { ...prev.states, 'light.x': { entity_id: 'light.x', state: 'on' } } } as any;
    expect(card.isUpdatePending).toBe(false);
    card.hass = { ...prev, states: { ...prev.states, 'sensor.lux': { ...prev.states['sensor.lux'], state: '30000' } } } as any;
    expect(card.isUpdatePending).toBe(true);
  });

  it('renders with null style values in yaml', async () => {
    const card = await mount({ style: null } as any, { 'sensor.t': { state: '20' } });
    expect($(card, '.temp')!.textContent!.trim()).toBe('20.0°');
  });
});
