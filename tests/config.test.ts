import { mergeConfig, pruneDefaults } from '../src/config';

describe('mergeConfig', () => {
  it('fills defaults', () => {
    const c = mergeConfig({ type: 'custom:room-info-card', entity: 'sensor.t' });
    expect(c.decimals).toBe(1);
    expect(c.trend).toEqual({ enabled: true, window: 30, stable_threshold: 0.2, show_stable: true });
    expect(c.comfort).toEqual({ cold_below: 19, hot_above: 22 });
    expect(c.luminance).toBeUndefined();
    expect(c.style.background).toBe('glass');
    expect(c.style.colors.trend_up).toBe('orange');
    expect(c.tap_action).toEqual({ action: 'more-info' });
  });

  it('deep merges partial nested values', () => {
    const c = mergeConfig({ type: 't', entity: 'sensor.t', trend: { window: 60 }, style: { colors: { hot: '#f00' } } });
    expect(c.trend.window).toBe(60);
    expect(c.trend.stable_threshold).toBe(0.2);
    expect(c.style.colors.hot).toBe('#f00');
    expect(c.style.colors.cold).toBe('blue');
  });

  it('applies luminance defaults only when provided', () => {
    expect(mergeConfig({ type: 't', entity: 'sensor.t', luminance: { entity: 'sensor.l' } }).luminance)
      .toEqual({ entity: 'sensor.l', dark_below: 5000, bright_above: 20000 });
  });

  it('throws without entity', () => {
    expect(() => mergeConfig({ type: 't' } as any)).toThrow(/entity/);
    expect(() => mergeConfig({ type: 't', entity: '' })).toThrow(/entity/);
  });
});

describe('pruneDefaults', () => {
  it('prunes defaults and empty objects', () => {
    expect(pruneDefaults({ type: 't', entity: 'sensor.t', decimals: 1, trend: { window: 30, enabled: true }, style: { radius: 20 } }))
      .toEqual({ type: 't', entity: 'sensor.t', style: { radius: 20 } });
  });

  it('round-trips: merge(prune(x)) equals merge(x)', () => {
    const x = {
      type: 't',
      entity: 'sensor.t',
      comfort: { hot_above: 23 },
      style: { tint: 'custom' as const, tint_color: [1, 2, 3] as [number, number, number] },
    };
    expect(mergeConfig(pruneDefaults(x))).toEqual(mergeConfig(x));
  });
});
