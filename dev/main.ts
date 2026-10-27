import './stubs';
import '../src/room-info-card';
import type { UserConfig } from '../src/config';

const now = Date.now();
const MIN = 60_000;

// entity -> [value 40 min ago, current value]
const series: Record<string, [number, number]> = {
  'sensor.chambre_1': [20.2, 19.7],
  'sensor.chambre_2': [19.2, 19.2],
  'sensor.chambre_3': [19.0, 19.6],
  'sensor.salon': [20.6, 20.1],
  'sensor.cuisine': [20.9, 21.6],
  'sensor.amis': [19.5, 20.1],
  'sensor.parents': [19.1, 19.6],
  'sensor.pallier': [20.9, 20.4],
  'sensor.devant': [13.8, 13.1],
  'sensor.hot': [22.0, 23.4],
};

const states: Record<string, any> = {};
for (const [id, [, cur]] of Object.entries(series)) {
  states[id] = { entity_id: id, state: String(cur), attributes: {}, last_updated: new Date(now - MIN).toISOString() };
}
states['sensor.derriere'] = { entity_id: 'sensor.derriere', state: 'unavailable', attributes: {}, last_updated: new Date(now).toISOString() };
states['sensor.lux_dark'] = { entity_id: 'sensor.lux_dark', state: '1200', attributes: {}, last_updated: '' };
states['sensor.lux_cloud'] = { entity_id: 'sensor.lux_cloud', state: '9000', attributes: {}, last_updated: '' };
states['sensor.lux_sun'] = { entity_id: 'sensor.lux_sun', state: '32000', attributes: {}, last_updated: '' };

const hass = {
  states,
  locale: { language: 'fr' },
  connection: { addEventListener() {}, removeEventListener() {} },
  async callWS(msg: any) {
    const id = msg.entity_ids[0];
    const s = series[id];
    if (!s) return {};
    return { [id]: [{ s: String(s[0]), lu: (now - 40 * MIN) / 1000 }, { s: String(s[1]), lu: (now - MIN) / 1000 }] };
  },
};

const outdoor: UserConfig['style'] = { tint: 'custom', tint_color: [192, 242, 189], tint_opacity: 0.6 };
const cards: Array<Partial<UserConfig>> = [
  { entity: 'sensor.chambre_1', name: 'Chambre 1', icon: 'mdi:face-man', luminance: { entity: 'sensor.lux_dark' } },
  { entity: 'sensor.chambre_2', name: 'Chambre 2', icon: 'mdi:face-man', luminance: { entity: 'sensor.lux_cloud' } },
  { entity: 'sensor.chambre_3', name: 'Chambre 3', icon: 'mdi:face-man', luminance: { entity: 'sensor.lux_sun' } },
  { entity: 'sensor.salon', name: 'Salon', icon: 'mdi:home-floor-0' },
  { entity: 'sensor.cuisine', name: 'Cuisine', icon: 'mdi:countertop' },
  { entity: 'sensor.amis', name: 'Chambre amis', icon: 'mdi:bed' },
  { entity: 'sensor.parents', name: 'Parents', icon: 'mdi:bed-queen' },
  { entity: 'sensor.pallier', name: 'Pallier', icon: 'mdi:stairs', style: { background: 'solid' } },
  { entity: 'sensor.devant', name: 'Devant', icon: 'mdi:gate', style: outdoor },
  { entity: 'sensor.derriere', name: 'Derrière', icon: 'mdi:tree', style: outdoor },
  { entity: 'sensor.hot', name: 'Teinte temp.', icon: 'mdi:sofa', style: { tint: 'temperature' } },
];

const grid = document.getElementById('grid')!;
for (const cfg of cards) {
  const el = document.createElement('room-info-card');
  el.setConfig({ type: 'custom:room-info-card', ...cfg } as UserConfig);
  el.hass = hass as any;
  grid.appendChild(el);
}
