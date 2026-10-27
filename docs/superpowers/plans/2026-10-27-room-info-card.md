# room-info-card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `custom:room-info-card`, a Lovelace card showing one room's temperature with self-computed trend, comfort colour, optional luminance badge, glass style and a graphical editor.

**Architecture:** Pure logic modules (`config`, `colors`, `trend`) unit-tested with Vitest; a thin I/O module (`history`) over `hass.callWS`; a Lit `room-info-card` element and a `room-info-card-editor` built on HA's `ha-form`. Rollup bundles everything into `dist/room-info-card.js`; a Vite dev page with HA element stubs is used for visual checks.

**Tech Stack:** TypeScript 5 (strict), Lit 3, Rollup 4 (`@rollup/plugin-node-resolve`, `@rollup/plugin-typescript`, `@rollup/plugin-terser`), Vitest + happy-dom, Vite (dev page), `@mdi/js` (dev stubs only).

**Spec:** `docs/superpowers/specs/2026-10-27-room-info-card-design.md`

## Global Constraints

- Card type `custom:room-info-card`, element `room-info-card`, editor element `room-info-card-editor`.
- No runtime dependency other than `lit`; no `custom-card-helpers`, mushroom or card-mod. HA types declared locally in `src/types.ts`.
- Defaults exactly as spec §2 (decimals 1, trend window 30 / threshold 0.2 / show_stable true, comfort 19/22, luminance 5000/20000, style glass/none/0.25/14/0.35/16/10/36, colors blue/green/red/orange/blue/green).
- Threshold equality rules from spec §2: equal to a comfort or luminance bound → middle level; `|delta| === stable_threshold` → not stable.
- Unavailable display: `—`, grey icon (`var(--disabled-color)`), no trend badge, no temperature tint.
- Editor labels French when `hass.locale.language` starts with `fr`, English otherwise.
- Windows dev machine: npm scripts must not rely on POSIX-only shell syntax.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Non-numeric or missing temperature state (`"unknown"`, `""`, entity removed) → `—`, no crash, no trend badge. *(Task 5 test `renders dash when unavailable`.)*
2. Card detached and re-attached (view switch, editor preview) → exactly one 60 s timer, history refetched once, no leaked intervals. *(Task 5 test `restarts timer on reconnect`.)*
3. Entity changed in editor while a history request is in flight → stale response for the old entity is ignored. *(Task 5 test `ignores stale history response`.)*
4. `tint: custom` without `tint_color`, or `tint_color` as `[r,g,b]` array → no tint / `rgb(r, g, b)`, never `undefined` in CSS. *(Task 2 tests on `resolveColor`.)*
5. Luminance entity unavailable or non-numeric → no luminance badge, rest of card intact. *(Task 5 test `hides luminance badge when lux unavailable`.)*

---

### Task 1: Project scaffold + config module

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` (`node_modules/`), `src/types.ts`, `src/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces (`src/types.ts`): `HomeAssistant` (`states: Record<string, HassEntity>`, `locale: { language: string }`, `callWS<T>(msg: Record<string, unknown>): Promise<T>`, `connection: { addEventListener(ev: 'ready', cb: () => void): void; removeEventListener(...) }`), `HassEntity` (`entity_id, state: string, attributes: Record<string, any>, last_updated: string`), `ActionConfig` (`{ action: 'more-info' | 'navigate' | 'none'; navigation_path?: string }`).
- Produces (`src/config.ts`):
  - `type Background = 'glass' | 'solid' | 'none'`, `type Tint = 'none' | 'temperature' | 'custom'`, `type ColorValue = string | [number, number, number]`
  - `interface TrendConfig { enabled: boolean; window: number; stable_threshold: number; show_stable: boolean }`
  - `interface ComfortConfig { cold_below: number; hot_above: number }`
  - `interface LuminanceConfig { entity: string; dark_below: number; bright_above: number }`
  - `interface StyleColors { cold; comfort; hot; trend_up; trend_down; trend_stable: ColorValue }`
  - `interface StyleConfig { background: Background; tint: Tint; tint_color: ColorValue | null; tint_opacity; blur; opacity; radius; font_size; icon_size: number; colors: StyleColors }`
  - `interface RoomInfoCardConfig { type: string; entity: string; name?: string; icon?: string; decimals: number; tap_action: ActionConfig; trend: TrendConfig; comfort: ComfortConfig; luminance?: LuminanceConfig; style: StyleConfig }`
  - `type UserConfig` = deep-partial of the above with `entity` required-ish (validated at runtime).
  - `const DEFAULTS` (everything except `type`, `entity`, `name`, `icon`, `luminance.entity`; `luminance` defaults `{ dark_below: 5000, bright_above: 20000 }` only applied when user supplies `luminance`).
  - `mergeConfig(user: UserConfig): RoomInfoCardConfig` — deep merge over `DEFAULTS`; throws `Error('room-info-card: "entity" is required')` when `entity` missing or empty.
  - `pruneDefaults(config: UserConfig): UserConfig` — removes keys deep-equal to defaults, then empty objects; always keeps `type` and `entity`; drops `luminance` if its `entity` is empty.

- [ ] **Step 1: Scaffold**

`package.json` (`"type": "module"`, `"private": true`), scripts: `build: rollup -c`, `watch: rollup -c -w`, `test: vitest run`, `dev: vite dev/ --open`. Install: `npm i lit` and `npm i -D typescript tslib vitest happy-dom vite rollup @rollup/plugin-node-resolve @rollup/plugin-typescript @rollup/plugin-terser @mdi/js`. `tsconfig.json`: `target ES2021`, `module ESNext`, `moduleResolution bundler`, `strict`, `experimentalDecorators: true`, `useDefineForClassFields: false`, `lib ["ES2021","DOM"]`, include `src`, `tests`, `dev`. `vitest.config.ts`: `environment: 'happy-dom'`.

- [ ] **Step 2: Write failing tests** in `tests/config.test.ts`

```ts
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
  expect(c.trend.window).toBe(60); expect(c.trend.stable_threshold).toBe(0.2);
  expect(c.style.colors.hot).toBe('#f00'); expect(c.style.colors.cold).toBe('blue');
});
it('applies luminance defaults only when provided', () => {
  expect(mergeConfig({ type: 't', entity: 'sensor.t', luminance: { entity: 'sensor.l' } }).luminance)
    .toEqual({ entity: 'sensor.l', dark_below: 5000, bright_above: 20000 });
});
it('throws without entity', () => {
  expect(() => mergeConfig({ type: 't' } as any)).toThrow(/entity/);
  expect(() => mergeConfig({ type: 't', entity: '' })).toThrow(/entity/);
});
it('prunes defaults and empty objects', () => {
  expect(pruneDefaults({ type: 't', entity: 'sensor.t', decimals: 1, trend: { window: 30, enabled: true }, style: { radius: 20 } }))
    .toEqual({ type: 't', entity: 'sensor.t', style: { radius: 20 } });
});
it('round-trips: merge(prune(x)) equals merge(x)', () => {
  const x = { type: 't', entity: 'sensor.t', comfort: { hot_above: 23 }, style: { tint: 'custom' as const, tint_color: [1, 2, 3] as [number, number, number] } };
  expect(mergeConfig(pruneDefaults(x))).toEqual(mergeConfig(x));
});
```

- [ ] **Step 3: Run** `npx vitest run tests/config.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 4: Implement `src/types.ts` and `src/config.ts`** per Interfaces. Arrays (e.g. `tint_color`) are replaced, not merged.
- [ ] **Step 5: Run** `npx vitest run tests/config.test.ts` — Expected: 6 passed.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: scaffold project and config module"`

---

### Task 2: Colour and level helpers

**Files:**
- Create: `src/colors.ts`
- Test: `tests/colors.test.ts`

**Interfaces:**
- Consumes: `ComfortConfig`, `LuminanceConfig`, `ColorValue` from `src/config.ts`.
- Produces:
  - `type ComfortLevel = 'cold' | 'comfort' | 'hot'`; `comfortLevel(value: number, c: ComfortConfig): ComfortLevel`
  - `type LuminanceLevel = 'dark' | 'cloudy' | 'bright'`; `luminanceLevel(lux: number, l: LuminanceConfig): LuminanceLevel`
  - `LUMINANCE_BADGE: Record<LuminanceLevel, { emoji: string; background: string }>` = dark `🌑`/`#007bff`, cloudy `⛅`/`#28a745`, bright `☀️`/`#ffc107`
  - `resolveColor(color: ColorValue | null | undefined): string | undefined`
  - `parseNumber(state: string | undefined): number | null` — `null` for `unknown`, `unavailable`, `''`, `undefined`, NaN.

- [ ] **Step 1: Write failing tests**

```ts
it.each([[18.9,'cold'],[19,'comfort'],[22,'comfort'],[22.1,'hot']])('comfort %s → %s', (v, e) =>
  expect(comfortLevel(v, { cold_below: 19, hot_above: 22 })).toBe(e));
it.each([[4999,'dark'],[5000,'cloudy'],[20000,'cloudy'],[20001,'bright']])('lux %s → %s', (v, e) =>
  expect(luminanceLevel(v, { entity: 'x', dark_below: 5000, bright_above: 20000 })).toBe(e));
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
  expect(resolveColor(null)).toBeUndefined(); expect(resolveColor(undefined)).toBeUndefined(); expect(resolveColor('')).toBeUndefined();
});
it.each([['19.74',19.74],['unknown',null],['unavailable',null],['',null],[undefined,null],['abc',null]])('parseNumber %s', (s, e) =>
  expect(parseNumber(s as any)).toBe(e));
```

- [ ] **Step 2: Run** `npx vitest run tests/colors.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `src/colors.ts`.** Named colours: `primary, accent, disabled, red, pink, purple, deep-purple, indigo, blue, light-blue, cyan, teal, green, light-green, lime, yellow, amber, orange, deep-orange, brown, grey, blue-grey, black, white` → `var(--<name>-color)`; any other string returned as-is.
- [ ] **Step 4: Run** `npx vitest run tests/colors.test.ts` — Expected: all pass.
- [ ] **Step 5: Commit** `git add src/colors.ts tests/colors.test.ts && git commit -m "feat: add colour and level helpers"`

---

### Task 3: Trend computation

**Files:**
- Create: `src/trend.ts`
- Test: `tests/trend.test.ts`

**Interfaces:**
- Produces: `interface Point { t: number; v: number }` (t in ms), `type Trend = 'up' | 'down' | 'stable'`,
  `computeTrend(points: Point[], now: number, windowMs: number, threshold: number): Trend | null`,
  `prune(points: Point[], now: number, windowMs: number): Point[]`,
  `addPoint(points: Point[], p: Point): Point[]` (appends unless `p.t` ≤ last `t`; returns new array).

Algorithm (spec §4.4–4.5): reference = last point with `t <= now - windowMs`, else the oldest point; current = last point; `< 2` points or reference is current → `null`; `delta = current.v - reference.v`; `Math.abs(delta) < threshold` → `stable`; `delta > 0` → `up`; else `down`. Points are assumed sorted by `t`.

- [ ] **Step 1: Write failing tests** (`W = 30*60_000`, `now = 10*W`)

```ts
const p = (minAgo: number, v: number) => ({ t: now - minAgo * 60_000, v });
it('up', () => expect(computeTrend([p(40,19), p(10,19.5)], now, W, 0.2)).toBe('up'));
it('down', () => expect(computeTrend([p(40,20), p(1,19.5)], now, W, 0.2)).toBe('down'));
it('stable', () => expect(computeTrend([p(40,20), p(1,20.1)], now, W, 0.2)).toBe('stable'));
it('delta equal to threshold is not stable', () => expect(computeTrend([p(40,20), p(1,20.25)], now, W, 0.25)).toBe('up'));
it('uses last point before window as reference', () =>
  expect(computeTrend([p(50,25), p(35,19), p(20,19.1), p(1,19.15)], now, W, 0.2)).toBe('stable'));
it('falls back to oldest point when none before window', () =>
  expect(computeTrend([p(20,19), p(1,19.5)], now, W, 0.2)).toBe('up'));
it('null with fewer than 2 points', () => {
  expect(computeTrend([], now, W, 0.2)).toBeNull();
  expect(computeTrend([p(40,19)], now, W, 0.2)).toBeNull();
});
it('null when reference is the current point', () =>
  expect(computeTrend([p(50,18), p(40,19)], now, W, 0.2)).toBeNull());
it('prune keeps reference and later points', () =>
  expect(prune([p(50,1), p(40,2), p(20,3)], now, W)).toEqual([p(40,2), p(20,3)]));
it('addPoint ignores out-of-order points', () =>
  expect(addPoint([p(10,1)], p(20,2))).toEqual([p(10,1)]));
```

- [ ] **Step 2: Run** `npx vitest run tests/trend.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `src/trend.ts`.**
- [ ] **Step 4: Run** — Expected: all pass.
- [ ] **Step 5: Commit** `feat: add trend computation`.

---

### Task 4: History fetch

**Files:**
- Create: `src/history.ts`
- Test: `tests/history.test.ts`

**Interfaces:**
- Consumes: `HomeAssistant` (`src/types.ts`), `Point` (`src/trend.ts`), `parseNumber` (`src/colors.ts`).
- Produces: `fetchHistory(hass: HomeAssistant, entityId: string, windowMs: number, now?: number): Promise<Point[]>` — never rejects; on error `console.warn('room-info-card: history fetch failed', err)` and returns `[]`.

WS message (exact): `{ type: 'history/history_during_period', start_time: new Date(now - windowMs).toISOString(), entity_ids: [entityId], include_start_time_state: true, minimal_response: true, no_attributes: true, significant_changes_only: false }`. Response shape: `Record<string, Array<{ s: string; lu: number }>>` with `lu` in seconds → `t = Math.round(lu * 1000)`. Non-numeric `s` skipped; result sorted by `t`.

- [ ] **Step 1: Write failing tests** with `hass = { callWS: vi.fn() } as any`:
  - `sends the expected message`: `expect(callWS).toHaveBeenCalledWith({ ...exact message above with now = Date.UTC(2026,0,1) and windowMs = 30*60_000 })`, `start_time === '2025-12-31T23:30:00.000Z'`.
  - `maps states to points`: response `{ 'sensor.t': [{ s: '19.5', lu: 100 }, { s: 'unavailable', lu: 101 }, { s: '20', lu: 102.5 }] }` → `[{ t: 100000, v: 19.5 }, { t: 102500, v: 20 }]`.
  - `returns [] when entity missing in response`: `{}` → `[]`.
  - `returns [] on error`: `callWS.mockRejectedValue(new Error('x'))` → resolves `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/history.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `src/history.ts`.**
- [ ] **Step 4: Run** — Expected: 4 passed.
- [ ] **Step 5: Commit** `feat: add history fetch`.

---

### Task 5: Card element, styles, build and dev page

**Files:**
- Create: `src/room-info-card.ts`, `src/styles.ts`, `rollup.config.mjs`, `dev/index.html`, `dev/stubs.ts`, `dev/background.jpg` (any free-licence autumn forest image, or a CSS gradient if none available offline)
- Test: `tests/card.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `class RoomInfoCard extends LitElement` registered as `room-info-card`, with `setConfig(c: UserConfig)`, `set hass(h: HomeAssistant)`, `getCardSize(): 2`, `getGridOptions(): { columns: 3, rows: 2, min_columns: 2, min_rows: 2 }`, `static getConfigElement()` (returns `document.createElement('room-info-card-editor')`, element defined in Task 6 — import `./editor` at top of file once Task 6 exists; in this task the method may reference the tag only), `static getStubConfig(hass)`. Registers `window.customCards.push({ type: 'room-info-card', name: 'Room Info Card', description: 'Température, tendance et confort d\'une pièce', preview: true })`.
- Testable internals (protected, reachable via `card['…']` in tests): `_points: Point[]`, `_trend: Trend | null`, `_timer?: number`.

Rendering (spec §3): `<ha-card tabindex="0" role="button">` → `.icon-wrap` (size `icon_size`, background = comfort colour via `color-mix(in srgb, <c> 20%, transparent)`) containing `<ha-icon .icon>` coloured with comfort colour, `.badge.lux` (top-left, only if luminance entity numeric), `.badge.trend` (top-right, `<ha-icon>` white on `trend_*` colour, only when `_trend` non-null and not (`stable` && !show_stable)); `.temp` and `.name` (font-size `font_size`). Style values passed as CSS custom properties on `ha-card` (`--ric-radius`, `--ric-blur`, `--ric-opacity`, `--ric-font-size`, `--ric-icon-size`, `--ric-tint`, `--ric-tint-opacity`); background variants via `ha-card.glass|solid|none` classes per spec §3. Tint drawn by a `::before` overlay. Trend icons: up `mdi:arrow-top-right-thick`, down `mdi:arrow-bottom-right-thick`, stable `mdi:arrow-right-bold`. Name fallback `attributes.friendly_name ?? entity`; icon fallback `attributes.icon ?? 'mdi:thermometer'`.

Lifecycle (spec §4): on first `hass` (and on `hass.connection` `ready` events) call `_load()`: increment `_reqId`, `await fetchHistory`, discard result if `_reqId` changed or entity changed, else `_points = prune(result)`; on each `hass` set, if entity `last_updated` changed and numeric → `addPoint`; `connectedCallback` starts `setInterval(_tick, 60_000)` (clearing any existing one first) and reloads history if `hass` already set; `disconnectedCallback` clears it and removes the `ready` listener; `_tick` prunes and recomputes `_trend`. `setConfig` with changed `entity` or `trend.window` resets `_points` and triggers `_load()` if `hass` set. `trend.enabled: false` → no fetch, no badge.

Tap: on click / Enter / Space, `this.dispatchEvent(new CustomEvent('hass-action', { bubbles: true, composed: true, detail: { config: { entity, tap_action }, action: 'tap' } }))`.

- [ ] **Step 1: Write failing tests** in `tests/card.test.ts` (mock `../src/history` with `vi.mock`, use fake timers; helper `mount(config, states)` appends the element to `document.body`, sets config and `hass = { states, locale: { language: 'fr' }, callWS: vi.fn(), connection: { addEventListener: vi.fn(), removeEventListener: vi.fn() } }`, awaits `updateComplete`):
  - `renders temperature, name and icon`: state `'19.74'`, `name: 'Chambre 1'`, `icon: 'mdi:face-man'` → `.temp` text `19.7°`, `.name` text `Chambre 1`, `ha-icon` in `.icon-wrap` has `icon === 'mdi:face-man'`.
  - `renders dash when unavailable` (Review Focus 1): states `'unavailable'`, `''`, and entity absent → `.temp` is `—`, no `.badge.trend`, `.icon-wrap` has class `unavailable`.
  - `shows trend up badge`: `fetchHistory` resolves `[{t: now-40min, v: 19}, {t: now-1min, v: 19.6}]` → `.badge.trend ha-icon` icon `mdi:arrow-top-right-thick`.
  - `hides stable badge when show_stable false`.
  - `appends live updates`: after load, set `hass` with new `last_updated` and value → `_points.length` increased by 1.
  - `restarts timer on reconnect` (Review Focus 2): remove and re-append element → `vi.getTimerCount() === 1`; `fetchHistory` called twice in total.
  - `ignores stale history response` (Review Focus 3): first `fetchHistory` returns a deferred promise; call `setConfig` with another entity; resolve the first with up-trend points, second with `[]` → no `.badge.trend`.
  - `shows luminance badge`: lux `'25000'` → `.badge.lux` text `☀️`.
  - `hides luminance badge when lux unavailable` (Review Focus 5).
  - `fires hass-action on tap`: click `ha-card` → listener receives `detail.action === 'tap'` and `detail.config.tap_action.action === 'more-info'`.
  - `throws on missing entity`: `setConfig({ type: 't' })` throws.
- [ ] **Step 2: Run** `npx vitest run tests/card.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `src/styles.ts` and `src/room-info-card.ts`.**
- [ ] **Step 4: Run** `npx vitest run` — Expected: all suites pass.
- [ ] **Step 5: Build config** `rollup.config.mjs`: input `src/room-info-card.ts`, output `dist/room-info-card.js` (`format: 'es'`), plugins `nodeResolve()`, `typescript()`, `terser({ format: { comments: false } })`. Run `npm run build` — Expected: `dist/room-info-card.js` created, no TS errors.
- [ ] **Step 6: Dev page.** `dev/stubs.ts` defines `ha-card` (div with slot, `display:block`) and `ha-icon` (renders an `<svg>` with the path from `@mdi/js`, name `mdi:face-man` → `mdiFaceMan`). `dev/index.html` loads stubs + `../src/room-info-card.ts`, sets a background image, a 6-column grid of cards covering: normal ×3 with trend up/down/stable, unavailable, `tint: custom` green (Devant), `tint: temperature`, no luminance, `background: solid`. Fake `hass.callWS` returns synthetic history.
- [ ] **Step 7: Visual check.** Run `npm run dev` in background, open the page in the built-in browser, screenshot, compare with the original tiles (glass background, badge positions, sizes). Fix discrepancies.
- [ ] **Step 8: Commit** `feat: add room-info-card element, build and dev page` (include `dist/`).

---

### Task 6: Graphical editor + localisation

**Files:**
- Create: `src/editor.ts`, `src/localize.ts`
- Modify: `src/room-info-card.ts` (import `./editor`; `getStubConfig`)
- Test: `tests/editor.test.ts`

**Interfaces:**
- Consumes: `UserConfig`, `pruneDefaults`, `mergeConfig` (Task 1).
- Produces:
  - `localize(key: string, lang: string): string` — keys are field paths (`entity`, `trend.window`, `style.colors.hot`, panel ids `panel.general|trend|comfort|luminance|appearance|colors`, select options `background.glass` …); French table + English table; unknown key → key.
  - `buildSchema(config: UserConfig): HaFormSchema[]` exported from `editor.ts` (panels as spec §5 table; `style.tint_color` only when `config.style?.tint === 'custom'`).
  - `class RoomInfoCardEditor extends LitElement` (`room-info-card-editor`): `setConfig(c)`, `hass` property; renders `<ha-form .hass .data=${mergeConfig-like view of config} .schema .computeLabel>`; on `value-changed` dispatches `config-changed` with `{ config: pruneDefaults(value) }` (bubbles, composed).
  - `RoomInfoCard.getStubConfig(hass)` → `{ entity: <first sensor with attributes.device_class === 'temperature'> ?? '' }`.

Nested panels: use `ha-form` `{ type: 'expandable', name: 'trend', title, schema: [...] }` so data nests under `trend`; the general panel uses `flatten: true`. Selectors: `entity` → `{ entity: { domain: 'sensor', device_class: 'temperature' } }`, luminance entity → `{ entity: { domain: 'sensor', device_class: 'illuminance' } }`, numbers per spec §5 ranges (`mode: 'slider'` for opacity/tint_opacity/blur/radius/font_size/icon_size, `step: 0.05` for opacities), `tap_action` → `{ ui_action: {} }`, colours → `{ ui_color: {} }`, tint colour → `{ color_rgb: {} }`, selects with `{ select: { mode: 'dropdown', options } }`.

- [ ] **Step 1: Write failing tests:**
  - `schema panels in order`: top-level entries are expandables named `general` (`flatten: true`), `trend`, `comfort`, `luminance`, `style`; the `style` expandable's schema ends with an expandable named `colors` holding the 6 colour fields.
  - `tint_color only with custom tint`: `buildSchema({entity:'x', style:{tint:'custom'}})` contains a field named `tint_color`; with `tint: 'none'` it does not.
  - `labels are French for fr and English otherwise`: `localize('trend.window','fr') === 'Fenêtre (min)'`, `localize('trend.window','en') === 'Window (min)'`.
  - `emits pruned config`: mount editor, dispatch `value-changed` from `ha-form` stub with `{ type:'t', entity:'sensor.t', decimals: 1, comfort: { hot_above: 23 } }` → `config-changed` detail `{ type:'t', entity:'sensor.t', comfort: { hot_above: 23 } }`.
  - `stub config picks a temperature sensor`.
- [ ] **Step 2: Run** `npx vitest run tests/editor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `src/localize.ts`, `src/editor.ts`, update card.**
- [ ] **Step 4: Run** `npx vitest run` then `npm run build` — Expected: all pass, bundle built.
- [ ] **Step 5: Commit** `feat: add graphical editor`.

---

### Task 7: Packaging, migration YAML, real HA check

**Files:**
- Create: `hacs.json` (`{ "name": "Room Info Card", "filename": "room-info-card.js", "render_readme": true }`), `README.md` (FR: install, options table from spec §2, example), `docs/migration.yaml`

- [ ] **Step 1: Migration YAML.** Query HA (`ha_config_get_dashboard` search `query: "mushroom-template-card"` on the tablet dashboard) to retrieve all 10 tiles. For each: `entity`, `name` (from `secondary`), `icon`, `luminance.entity` (from the card_mod `lux` line). Devant/Derrière: `style: { tint: custom, tint_color: [124, 179, 66] }`. Keep the outer `type: grid` (`square: false`, `columns: 3`, existing `grid_options`). If HA is unreachable, write the three known tiles (Chambre 1, 2, 3 from the pasted config) and list the missing ones in the README as TODO for the user.
- [ ] **Step 2: Install in HA** (only with user approval at that point): copy `dist/room-info-card.js` to `/config/www/` (user action, or via an available tool) and register resource `/local/room-info-card.js?v=1` (module) with `ha_config_set_dashboard_resource`.
- [ ] **Step 3: Real check.** Add one test card on a non-production view through the graphical editor; confirm rendering, trend badge after load, editor panels, French labels. Screenshot.
- [ ] **Step 4: Commit** `docs: add README, HACS manifest and migration YAML`.
