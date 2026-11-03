// Tests for the built replay data (lib/ops/demo/scenario-2020-01-01.json) and
// the conversion helpers in scripts/build-demo-scenario.mjs.
import { describe, expect, it } from 'vitest';
import {
  mapSiaga,
  mmToCm,
  openMeteoToRainPoints,
  qcSeries,
  thresholds2020,
  wibToUtcIso,
} from '../../../scripts/build-demo-scenario.mjs';
import rawRain from './raw/open-meteo-era5-2019-12-30_2020-01-02.json';
import { SCENARIO_DATA } from './data';

const SIAGA = new Set(['normal', 'siaga3', 'siaga2', 'siaga1', 'unknown']);
const QUALITY = new Set(['ok', 'suspect', 'stale']);
const isIsoUtc = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s);

describe('scenario JSON', () => {
  it('loads and matches the contract types', () => {
    const d = SCENARIO_DATA;
    expect(d.id).toBe('banjir-2020-01-01');
    expect(d.stepMin).toBe(10);
    expect(isIsoUtc(d.window.start) && isIsoUtc(d.window.end)).toBe(true);
    expect(d.stations.length).toBe(21);
    for (const s of d.stations) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.river).toBe('string');
      expect(Number.isFinite(s.lat) && Number.isFinite(s.lon)).toBe(true);
      expect(typeof s.thresholds.source).toBe('string');
      for (const k of ['siaga3', 'siaga2', 'siaga1'] as const) {
        expect(s.thresholds[k] === null || typeof s.thresholds[k] === 'number').toBe(true);
      }
      let prev = -Infinity;
      for (const p of s.series) {
        expect(isIsoUtc(p.ts)).toBe(true);
        expect(p.cm === null || typeof p.cm === 'number').toBe(true);
        expect(SIAGA.has(p.siaga)).toBe(true);
        expect(QUALITY.has(p.quality)).toBe(true);
        const ms = Date.parse(p.ts);
        expect(ms).toBeGreaterThan(prev); // ascending, de-duplicated
        expect(ms).toBeGreaterThanOrEqual(Date.parse(d.window.start));
        expect(ms).toBeLessThanOrEqual(Date.parse(d.window.end));
        prev = ms;
      }
    }
    expect(d.polders.map((p) => p.id).sort()).toEqual(
      ['bojong_indah', 'kelapa_gading', 'pulomas', 'setiabudi_timur', 'sunter_selatan'].sort(),
    );
    const stationIds = new Set(d.stations.map((s) => s.id));
    for (const p of d.polders) {
      expect(p.displayRadiusM).toBeGreaterThanOrEqual(600);
      expect(p.displayRadiusM).toBeLessThanOrEqual(900);
      expect(p.note).toContain('Titik acuan perkiraan; batas polder menunggu data S8');
      for (const id of p.stationIds) expect(stationIds.has(id)).toBe(true);
      for (const pump of p.pumps) expect(pump.capacityM3s === null || pump.capacityM3s > 0).toBe(true);
      const rain = d.rain[p.id];
      expect(rain.series.length).toBeGreaterThan(60);
      for (const r of rain.series) {
        expect(isIsoUtc(r.ts)).toBe(true);
        expect(r.mm).toBeGreaterThanOrEqual(0);
      }
    }
    expect(d.sources.rain.kind).toBe('reanalysis');
    expect(d.sources.rain.source).toBe('Open-Meteo ERA5 (reanalisis, resolusi kasar)');
  });

  it('stays commit-sized', async () => {
    const { statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const bytes = statSync(join(__dirname, 'scenario-2020-01-01.json')).size;
    expect(bytes).toBeLessThan(400 * 1024);
  });

  it('uses pump capacities only where the polder evidence states them', () => {
    const st = SCENARIO_DATA.polders.find((p) => p.id === 'setiabudi_timur');
    expect(st?.pumps.map((p) => p.capacityM3s)).toEqual([1.74, 1.74, 1.74, 1.1, 1.1, 1.1]);
    for (const p of SCENARIO_DATA.polders.filter((x) => x.id !== 'setiabudi_timur')) {
      for (const pump of p.pumps) expect(pump.capacityM3s).toBeNull();
    }
  });
});

describe('unit and time conversion', () => {
  it('converts mm to cm', () => {
    expect(mmToCm(9690)).toBe(969);
    expect(mmToCm(450)).toBe(45);
    expect(mmToCm(-190)).toBe(-19);
    expect(mmToCm(null)).toBeNull();
  });

  it('converts WIB wall clock to UTC', () => {
    expect(wibToUtcIso('2020-01-02 00:40:00')).toBe('2020-01-01T17:40:00.000Z');
    expect(wibToUtcIso('2019-12-31 00:00')).toBe('2019-12-30T17:00:00.000Z');
    expect(SCENARIO_DATA.window.start).toBe('2019-12-30T17:00:00.000Z');
    expect(SCENARIO_DATA.window.end).toBe('2020-01-02T05:00:00.000Z');
  });

  it('maps DSDA status labels', () => {
    expect(mapSiaga('Status : Normal')).toBe('normal');
    expect(mapSiaga('Status : Siaga 1')).toBe('siaga1');
    expect(mapSiaga('Status : Siaga 3')).toBe('siaga3');
    expect(mapSiaga('???')).toBe('unknown');
  });

  it('shifts Open-Meteo hourly sums (preceding hour) to the hour start', () => {
    const pts = openMeteoToRainPoints({ time: ['2020-01-01T01:00'], precipitation: [2.5] });
    expect(pts[0]).toMatchObject({ ts: '2020-01-01T00:00:00.000Z', mm: 2.5 });
    const raw = (rawRain as { response: { hourly: { time: string[]; precipitation: number[] } }[] }).response[0];
    const i = raw.hourly.time.indexOf('2019-12-31T10:00');
    const json = SCENARIO_DATA.rain[SCENARIO_DATA.polders[0].id].series.find((r) => r.ts === '2019-12-31T09:00:00.000Z');
    expect(json?.mm).toBe(raw.hourly.precipitation[i]);
  });
});

describe('real archive facts', () => {
  const byId = new Map(SCENARIO_DATA.stations.map((s) => [s.id, s]));

  it('keeps the real Manggarai peak of 969 cm at Siaga 1', () => {
    const mg = byId.get('manggarai');
    const peak = Math.max(...(mg?.series.map((p) => p.cm ?? -Infinity) ?? []));
    expect(peak).toBe(969);
    const at = mg?.series.find((p) => p.cm === 969);
    expect(at?.siaga).toBe('siaga1');
    expect(at?.ts).toBe('2020-01-01T17:40:00.000Z'); // 2 Jan 2020 00:40 WIB
    expect(mg?.series.some((p) => p.siaga === 'siaga1')).toBe(true);
    expect(mg?.thresholds).toMatchObject({ siaga3: 750, siaga2: 850, siaga1: 950 });
  });

  it('flags the stuck posts (Yos Sudarso 1, Pulo Gadung) without dropping readings', () => {
    for (const id of ['yos_sudarso_1', 'pulo_gadung']) {
      const s = byId.get(id);
      expect(s?.qc.stuck).toBe(true);
      expect(s?.series.length).toBeGreaterThan(10);
      expect(s?.series.every((p) => p.quality === 'suspect')).toBe(true);
    }
    expect(byId.get('manggarai')?.qc.stuck).toBe(false);
    const blind = SCENARIO_DATA.polders.filter((p) => p.blindSpot).map((p) => p.id).sort();
    expect(blind).toEqual(['kelapa_gading', 'pulomas', 'sunter_selatan']);
  });

  it('flags the isolated Depok dip as a spike', () => {
    const dp = byId.get('depok');
    const dip = dp?.series.find((p) => p.cm === 75);
    expect(dip?.quality).toBe('suspect');
    expect(dp?.qc.spikeTs).toContain(dip?.ts);
  });
});

describe('qcSeries', () => {
  const mk = (cms: number[]) => cms.map((cm, i) => ({ ts: new Date(Date.UTC(2020, 0, 1, 0, 30 * i)).toISOString(), cm, siaga: 'normal' }));

  it('flags a constant series as stuck', () => {
    const q = qcSeries(mk(new Array(20).fill(344)));
    expect(q.stuck).toBe(true);
    expect(q.points.every((p: { quality: string }) => p.quality === 'suspect')).toBe(true);
  });

  it('flags spikes and negatives, keeps every point', () => {
    const q = qcSeries(mk([100, 102, 400, 104, 106, -5, 108]));
    expect(q.points).toHaveLength(7);
    expect(q.points[2].quality).toBe('suspect');
    expect(q.points[5].quality).toBe('suspect');
    expect(q.points[1].quality).toBe('ok');
    expect(q.stuck).toBe(false);
  });

  it('does not flag a genuine fast rise', () => {
    const q = qcSeries(mk([40, 45, 77, 126, 130, 141]));
    expect(q.points.every((p: { quality: string }) => p.quality === 'ok')).toBe(true);
  });

  it('picks 2020 thresholds from the S2 evidence', () => {
    const th = thresholds2020({
      currentSource: 'dsda_posko_banjir_page',
      current: { siaga3: 90, siaga2: 160, siaga1: 210 },
      s2_2020: {
        siaga3: { max_below_cm: 136, min_at_cm: 144, value_cm: 140, result: 'unambiguous' },
        siaga2: { max_below_cm: 147, min_at_cm: 159, value_cm: null, result: 'bracket wider than 10 cm' },
        siaga1: { max_below_cm: 159, min_at_cm: null, value_cm: null, result: 'level not observed' },
      },
    });
    // 2020 Siaga 3 was 140 (today 90); 160 contradicts the 2020 bracket (147, 159] so stays null.
    expect(th).toMatchObject({ siaga3: 140, siaga2: null, siaga1: 210 });
  });
});
