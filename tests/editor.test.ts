import { DEFAULTS } from '../src/config';
import { buildSchema, type RoomInfoCardEditor } from '../src/editor';
import { localize } from '../src/localize';
import { RoomInfoCard } from '../src/room-info-card';

const names = (schema: any[]) => schema.map((s) => s.name);
const find = (schema: any[], name: string) => schema.find((s) => s.name === name);

describe('buildSchema', () => {
  it('schema panels in order', () => {
    const schema = buildSchema({ type: 't', entity: 'x' });
    expect(names(schema)).toEqual(['general', 'trend', 'comfort', 'luminance', 'style']);
    expect(schema.every((s: any) => s.type === 'expandable')).toBe(true);
    expect(find(schema, 'general').flatten).toBe(true);
    const style = find(schema, 'style').schema;
    const colors = style[style.length - 1];
    expect(colors.type).toBe('expandable');
    expect(colors.name).toBe('colors');
    expect(names(colors.schema)).toEqual(['cold', 'comfort', 'hot', 'trend_up', 'trend_down', 'trend_stable']);
  });

  it('tint_color only with custom tint', () => {
    const custom = find(buildSchema({ type: 't', entity: 'x', style: { tint: 'custom' } }), 'style').schema;
    expect(names(custom)).toContain('tint_color');
    const none = find(buildSchema({ type: 't', entity: 'x', style: { tint: 'none' } }), 'style').schema;
    expect(names(none)).not.toContain('tint_color');
  });

  it('filters entity selectors by device class', () => {
    const schema = buildSchema({ type: 't', entity: 'x' });
    expect(find(find(schema, 'general').schema, 'entity').selector.entity).toEqual({ domain: 'sensor', device_class: 'temperature' });
    expect(find(find(schema, 'luminance').schema, 'entity').selector.entity).toEqual({ domain: 'sensor', device_class: 'illuminance' });
  });
});

describe('localize', () => {
  it('labels are French for fr and English otherwise', () => {
    expect(localize('trend.window', 'fr')).toBe('Fenêtre (min)');
    expect(localize('trend.window', 'en')).toBe('Window (min)');
    expect(localize('trend.window', 'de')).toBe('Window (min)');
  });

  it('returns key for unknown label', () => expect(localize('nope', 'fr')).toBe('nope'));
});

describe('room-info-card-editor', () => {
  async function mountEditor(config: any) {
    const el = document.createElement('room-info-card-editor') as RoomInfoCardEditor;
    el.hass = { locale: { language: 'fr' }, states: {} } as any;
    el.setConfig(config);
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  }

  afterEach(() => (document.body.innerHTML = ''));

  it('emits pruned config', async () => {
    const el = await mountEditor({ type: 't', entity: 'sensor.t' });
    const listener = vi.fn();
    el.addEventListener('config-changed', listener);
    const form = el.shadowRoot!.querySelector('ha-form')!;
    form.dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { type: 't', entity: 'sensor.t', decimals: 1, comfort: { hot_above: 23 } } },
    }));
    expect(listener.mock.calls[0][0].detail.config).toEqual({ type: 't', entity: 'sensor.t', comfort: { hot_above: 23 } });
  });

  it('passes defaults to the form even with empty entity', async () => {
    const el = await mountEditor({ type: 't', entity: '' });
    const data = (el.shadowRoot!.querySelector('ha-form') as any).data;
    expect(data.trend.window).toBe(DEFAULTS.trend.window);
    expect(data.entity).toBe('');
  });

  it('uses French panel titles', async () => {
    const el = await mountEditor({ type: 't', entity: 'sensor.t' });
    const schema = (el.shadowRoot!.querySelector('ha-form') as any).schema;
    expect(find(schema, 'trend').title).toBe('Tendance');
  });
});

describe('getStubConfig', () => {
  it('stub config picks a temperature sensor', () => {
    const hass = {
      states: {
        'sensor.hum': { entity_id: 'sensor.hum', state: '40', attributes: { device_class: 'humidity' } },
        'sensor.temp': { entity_id: 'sensor.temp', state: '20', attributes: { device_class: 'temperature' } },
      },
    } as any;
    expect(RoomInfoCard.getStubConfig(hass)).toEqual({ entity: 'sensor.temp' });
    expect(RoomInfoCard.getStubConfig({ states: {} } as any)).toEqual({ entity: '' });
  });
});

describe('editor luminance', () => {
  it('shows luminance threshold defaults without entity', async () => {
    const el = document.createElement('room-info-card-editor') as RoomInfoCardEditor;
    el.hass = { locale: { language: 'fr' }, states: {} } as any;
    el.setConfig({ type: 't', entity: 'sensor.t' });
    document.body.appendChild(el);
    await el.updateComplete;
    const data = (el.shadowRoot!.querySelector('ha-form') as any).data;
    expect(data.luminance).toEqual({ dark_below: 5000, bright_above: 20000 });
  });

  it('keeps threshold edits until an entity is chosen', async () => {
    const el = document.createElement('room-info-card-editor') as RoomInfoCardEditor;
    el.hass = { locale: { language: 'fr' }, states: {} } as any;
    el.setConfig({ type: 't', entity: 'sensor.t' });
    document.body.appendChild(el);
    await el.updateComplete;
    const form = () => el.shadowRoot!.querySelector('ha-form') as any;
    form().dispatchEvent(new CustomEvent('value-changed', {
      detail: { value: { ...form().data, luminance: { dark_below: 3000, bright_above: 20000 } } },
    }));
    await el.updateComplete;
    expect(form().data.luminance.dark_below).toBe(3000);
  });
});
