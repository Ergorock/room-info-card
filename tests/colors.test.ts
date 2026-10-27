import { comfortLevel, luminanceLevel, parseNumber, resolveColor } from '../src/colors';

describe('comfortLevel', () => {
  it.each([[18.9, 'cold'], [19, 'comfort'], [22, 'comfort'], [22.1, 'hot']])('comfort %s → %s', (v, e) =>
    expect(comfortLevel(v as number, { cold_below: 19, hot_above: 22 })).toBe(e));
});

describe('luminanceLevel', () => {
  it.each([[4999, 'dark'], [5000, 'cloudy'], [20000, 'cloudy'], [20001, 'bright']])('lux %s → %s', (v, e) =>
    expect(luminanceLevel(v as number, { entity: 'x', dark_below: 5000, bright_above: 20000 })).toBe(e));
});

describe('resolveColor', () => {
  it('resolves HA named colours', () => {
    expect(resolveColor('blue')).toBe('var(--blue-color)');
    expect(resolveColor('deep-orange')).toBe('var(--deep-orange-color)');
  });

  it('passes through css colours', () => {
    expect(resolveColor('#7cb342')).toBe('#7cb342');
    expect(resolveColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
  });

  it('converts rgb arrays', () => expect(resolveColor([124, 179, 66])).toBe('rgb(124, 179, 66)'));

  it('returns undefined for missing colour', () => {
    expect(resolveColor(null)).toBeUndefined();
    expect(resolveColor(undefined)).toBeUndefined();
    expect(resolveColor('')).toBeUndefined();
  });
});

describe('parseNumber', () => {
  it.each([['19.74', 19.74], ['unknown', null], ['unavailable', null], ['', null], [undefined, null], ['abc', null]])(
    'parseNumber %s', (s, e) => expect(parseNumber(s as any)).toBe(e));
});
