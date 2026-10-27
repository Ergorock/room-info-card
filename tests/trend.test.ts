import { addPoint, computeTrend, prune } from '../src/trend';

const W = 30 * 60_000;
const now = 10 * W;
const p = (minAgo: number, v: number) => ({ t: now - minAgo * 60_000, v });

describe('computeTrend', () => {
  it('up', () => expect(computeTrend([p(40, 19), p(10, 19.5)], now, W, 0.2)).toBe('up'));
  it('down', () => expect(computeTrend([p(40, 20), p(1, 19.5)], now, W, 0.2)).toBe('down'));
  it('stable', () => expect(computeTrend([p(40, 20), p(1, 20.1)], now, W, 0.2)).toBe('stable'));
  it('delta equal to threshold is not stable', () =>
    expect(computeTrend([p(40, 20), p(1, 20.25)], now, W, 0.25)).toBe('up'));
  it('uses last point before window as reference', () =>
    expect(computeTrend([p(50, 25), p(35, 19), p(20, 19.1), p(1, 19.15)], now, W, 0.2)).toBe('stable'));
  it('falls back to oldest point when none before window', () =>
    expect(computeTrend([p(20, 19), p(1, 19.5)], now, W, 0.2)).toBe('up'));
  it('null with fewer than 2 points', () => {
    expect(computeTrend([], now, W, 0.2)).toBeNull();
    expect(computeTrend([p(40, 19)], now, W, 0.2)).toBeNull();
  });
  it('null when reference is the current point', () =>
    expect(computeTrend([p(50, 18), p(40, 19)], now, W, 0.2)).toBeNull());
});

describe('prune', () => {
  it('keeps reference and later points', () =>
    expect(prune([p(50, 1), p(40, 2), p(20, 3)], now, W)).toEqual([p(40, 2), p(20, 3)]));
});

describe('addPoint', () => {
  it('appends newer points', () => expect(addPoint([p(20, 1)], p(10, 2))).toEqual([p(20, 1), p(10, 2)]));
  it('ignores out-of-order points', () => expect(addPoint([p(10, 1)], p(20, 2))).toEqual([p(10, 1)]));
});
