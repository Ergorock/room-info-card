import { parseNumber } from './colors';
import type { Point } from './trend';
import type { HomeAssistant } from './types';

type HistoryResponse = Record<string, Array<{ s: string; lu: number }>>;

export async function fetchHistory(
  hass: HomeAssistant,
  entityId: string,
  windowMs: number,
  now: number = Date.now(),
): Promise<Point[]> {
  try {
    const res = await hass.callWS<HistoryResponse>({
      type: 'history/history_during_period',
      start_time: new Date(now - windowMs).toISOString(),
      entity_ids: [entityId],
      include_start_time_state: true,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    const points: Point[] = [];
    for (const row of res?.[entityId] ?? []) {
      const v = parseNumber(row.s);
      if (v !== null) points.push({ t: Math.round(row.lu * 1000), v });
    }
    return points.sort((a, b) => a.t - b.t);
  } catch (err) {
    console.warn('room-info-card: history fetch failed', err);
    return [];
  }
}
