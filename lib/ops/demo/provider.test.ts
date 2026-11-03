// Tests for the replay OpsProvider: no peeking, memoization, health, acks,
// and the demo-mode switch in lib/ops/provider.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACK_STORAGE_KEY, createDemoProvider, useDemoAckStore } from './provider';

const provider = createDemoProvider();
const scenario = provider.scenario!;
const startMs = Date.parse(scenario.start);
const endMs = Date.parse(scenario.end);
const STEP = scenario.stepMin * 60_000;

/** Every step, plus a few off-grid times (deterministic). */
const times: string[] = [];
for (let t = startMs; t <= endMs; t += STEP) times.push(new Date(t).toISOString());
for (const off of [1, 7 * 60_000 + 13_000, 9 * 60_000 + 59_000]) times.push(new Date(startMs + 600 * 60_000 + off).toISOString());

describe('scenario info', () => {
  it('describes the replay and discloses what is real and simulated', () => {
    expect(provider.mode).toBe('demo');
    expect(scenario.title).toBe('Skenario historis: Banjir 1 Januari 2020');
    expect(scenario.stepMin).toBe(10);
    const d = scenario.disclosure.join(' ');
    expect(d).toContain('ASLI');
    expect(d).toContain('SIMULASI');
    expect(d).toContain('ERA5');
    expect(d).toContain('tidak dihitung dalam skor');
    expect(scenario.initialTs).toBe('2019-12-31T16:40:00.000Z'); // 23:40 WIB, archive start
    expect(scenario.moments.length).toBeGreaterThanOrEqual(6);
  });
});

describe('no peeking', () => {
  it('a snapshot never contains data timestamped after its time', () => {
    for (const at of times) {
      const atMs = Date.parse(at);
      const s = provider.snapshotAt(at);
      expect(Date.parse(s.at)).toBeLessThanOrEqual(atMs);
      for (const r of s.stations) {
        if (r.latest) expect(Date.parse(r.latest.ts)).toBeLessThanOrEqual(atMs);
        if (r.ageMin !== null) expect(r.ageMin).toBeGreaterThanOrEqual(0);
      }
      for (const p of s.polders) {
        expect(Date.parse(p.status.provenance.ts)).toBeLessThanOrEqual(atMs);
        for (const c of p.nowcast) expect(Date.parse(c.provenance.ts)).toBeLessThanOrEqual(atMs);
      }
      for (const r of s.openRecommendations) {
        expect(Date.parse(r.provenance.ts)).toBeLessThanOrEqual(atMs);
        expect(Date.parse(r.windowEnd)).toBeGreaterThan(Date.parse(s.at));
      }
      for (const h of s.health) if (h.newestTs) expect(Date.parse(h.newestTs)).toBeLessThanOrEqual(atMs);
    }
  });

  it('series and histories stop at "to"', () => {
    const to = '2020-01-01T03:05:00.000Z';
    const toMs = Date.parse(to);
    for (const st of provider.stations()) {
      for (const p of provider.levelSeries(st.id, scenario.start, to)) expect(Date.parse(p.ts)).toBeLessThanOrEqual(toMs);
    }
    for (const p of provider.polders()) {
      for (const r of provider.rainSeries(p.id, scenario.start, to)) expect(Date.parse(r.ts) + 3_600_000).toBeLessThanOrEqual(toMs);
      for (const c of provider.nowcastHistory(p.id, scenario.start, to)) expect(Date.parse(c.provenance.ts)).toBeLessThanOrEqual(toMs);
      for (const s of provider.statusHistory(p.id, scenario.start, to)) expect(Date.parse(s.provenance.ts)).toBeLessThanOrEqual(toMs);
    }
    for (const r of provider.recommendationsUntil(to)) expect(Date.parse(r.provenance.ts)).toBeLessThanOrEqual(toMs);
  });

  it('returns no recommendation before the first one is issued', () => {
    expect(provider.recommendationsUntil(scenario.start)).toEqual([]);
  });
});

describe('memoization and shape', () => {
  it('rounds snapshot time down to the step and returns the same object', () => {
    const a = provider.snapshotAt('2020-01-01T00:13:00.000Z');
    const b = provider.snapshotAt('2020-01-01T00:19:59.000Z');
    expect(a).toBe(b);
    expect(a.at).toBe('2020-01-01T00:10:00.000Z');
    expect(a.polders).toHaveLength(provider.polders().length);
    expect(a.stations).toHaveLength(provider.stations().length);
  });

  it('returns stable arrays for identical series arguments', () => {
    const a = provider.levelSeries('manggarai', scenario.start, scenario.end);
    expect(provider.levelSeries('manggarai', scenario.start, scenario.end)).toBe(a);
    expect(a.some((p) => p.cm === 969)).toBe(true);
  });

  it('lists recommendations newest first', () => {
    const recs = provider.recommendationsUntil(scenario.end);
    for (let i = 1; i < recs.length; i += 1) {
      expect(Date.parse(recs[i - 1].provenance.ts)).toBeGreaterThanOrEqual(Date.parse(recs[i].provenance.ts));
    }
  });

  it('reports connector health relative to playback time', () => {
    const s = provider.snapshotAt('2020-01-01T05:00:00.000Z');
    const ids = s.health.map((h) => h.id);
    expect(ids).toEqual(['s2_tma_archive', 'era5_rain', 'demo_engine']);
    const s2 = s.health[0];
    expect(s2.provenance.kind).toBe('historical');
    expect(s2.ageMin).toBeGreaterThanOrEqual(0);
    expect(s.health[1].provenance.kind).toBe('reanalysis');
    // Before the archive starts the S2 connector has no fresh data.
    const early = provider.snapshotAt(scenario.start);
    expect(early.health[0].stale).toBe(true);
  });
});

describe('acknowledgements', () => {
  afterEach(() => useDemoAckStore.getState().reset());

  it('stores, persists and resets acknowledgements', () => {
    const { acknowledge } = useDemoAckStore.getState();
    acknowledge({ recommendationId: 'x', at: '2020-01-01T00:00:00.000Z', by: 'operator', action: 'followed' });
    expect(useDemoAckStore.getState().acks.x.action).toBe('followed');
    expect(window.localStorage.getItem(ACK_STORAGE_KEY)).toContain('followed');
    useDemoAckStore.getState().reset();
    expect(useDemoAckStore.getState().acks).toEqual({});
  });

  it('keeps working when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    useDemoAckStore.getState().acknowledge({ recommendationId: 'y', at: '2020-01-01T00:00:00.000Z', by: 'op', action: 'deferred' });
    expect(useDemoAckStore.getState().acks.y.action).toBe('deferred');
    spy.mockRestore();
  });
});

describe('getOpsProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // The /operator section is always the labelled historical replay, whatever
  // the demo flag says (lib/ops/provider.ts).
  it('returns the replay whether or not demo mode is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_NOAH_DEMO_MODE', '');
    vi.stubEnv('NOAH_DEMO_MODE', '');
    const mod = await import('../provider');
    const demo = mod.getOpsProvider();
    expect(demo.mode).toBe('demo');
    expect(demo.scenario).not.toBeNull();
    vi.stubEnv('NEXT_PUBLIC_NOAH_DEMO_MODE', 'true');
    expect(mod.getOpsProvider()).toBe(demo);
  });

  it('keeps the empty live stub for the future API provider', async () => {
    const mod = await import('../provider');
    expect(mod.emptyProvider.mode).toBe('live');
    expect(mod.emptyProvider.scenario).toBeNull();
  });
});
