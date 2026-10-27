import { fetchHistory } from '../src/history';

const now = Date.UTC(2026, 0, 1);
const W = 30 * 60_000;

function makeHass(callWS = vi.fn()) {
  return { hass: { callWS } as any, callWS };
}

describe('fetchHistory', () => {
  it('sends the expected message', async () => {
    const { hass, callWS } = makeHass(vi.fn().mockResolvedValue({}));
    await fetchHistory(hass, 'sensor.t', W, now);
    expect(callWS).toHaveBeenCalledWith({
      type: 'history/history_during_period',
      start_time: '2025-12-31T23:30:00.000Z',
      entity_ids: ['sensor.t'],
      include_start_time_state: true,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
  });

  it('maps states to points', async () => {
    const { hass } = makeHass(vi.fn().mockResolvedValue({
      'sensor.t': [{ s: '19.5', lu: 100 }, { s: 'unavailable', lu: 101 }, { s: '20', lu: 102.5 }],
    }));
    expect(await fetchHistory(hass, 'sensor.t', W, now)).toEqual([{ t: 100000, v: 19.5 }, { t: 102500, v: 20 }]);
  });

  it('returns [] when entity missing in response', async () => {
    const { hass } = makeHass(vi.fn().mockResolvedValue({}));
    expect(await fetchHistory(hass, 'sensor.t', W, now)).toEqual([]);
  });

  it('returns [] on error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { hass } = makeHass(vi.fn().mockRejectedValue(new Error('x')));
    expect(await fetchHistory(hass, 'sensor.t', W, now)).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
