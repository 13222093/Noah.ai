// Tests for the SIMULASI engine (demo-rule-v1): determinism, monotonicity,
// rate limit, message rules, and no recommendation before its trigger.
import { describe, expect, it } from 'vitest';
import type { ScenarioData } from './data';
import { SCENARIO_DATA } from './data';
import {
  ADVICE_SENTENCE,
  baseProbability,
  CATEGORY_RANK,
  categoryOf,
  levelIndex,
  rainBetweenMm,
  rainPastMm,
  runScenario,
  WHATSAPP_PREFIX,
  type NowcastFeatures,
} from './engine';
import { RATE_LIMIT_MIN, TRIGGER_THRESHOLDS } from './triggers';

const run = runScenario(SCENARIO_DATA);
const MIN = 60_000;

function scaleRain(data: ScenarioData, factor: number): ScenarioData {
  const copy: ScenarioData = JSON.parse(JSON.stringify(data));
  for (const k of Object.keys(copy.rain)) copy.rain[k].series = copy.rain[k].series.map((r) => ({ ...r, mm: r.mm * factor }));
  return copy;
}

describe('demo-rule-v1', () => {
  const f0: NowcastFeatures = {
    leadMin: 120,
    rainPast1hMm: 2,
    rainPast3hMm: 5,
    rainNextMm: 4,
    levelIndex: 0.2,
    riseIndex: 0.1,
    upstreamIndex: null,
  };

  it('is monotonic non-decreasing in every rain feature', () => {
    for (const key of ['rainPast1hMm', 'rainPast3hMm', 'rainNextMm'] as const) {
      let prev = -1;
      for (let mm = 0; mm <= 60; mm += 2) {
        const p = baseProbability({ ...f0, [key]: mm });
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it('rises with river level and with lead time of upstream signal', () => {
    expect(baseProbability({ ...f0, levelIndex: 1 })).toBeGreaterThan(baseProbability({ ...f0, levelIndex: 0 }));
    expect(baseProbability({ ...f0, leadMin: 180, upstreamIndex: 1 })).toBeGreaterThan(
      baseProbability({ ...f0, leadMin: 60, upstreamIndex: 1 }),
    );
  });

  it('computes the level index against 2020 thresholds', () => {
    expect(levelIndex(950, { siaga3: 750, siaga2: 850, siaga1: 950 })).toBe(1);
    expect(levelIndex(750, { siaga3: 750, siaga2: 850, siaga1: 950 })).toBe(0);
    expect(levelIndex(100, { siaga3: null, siaga2: null, siaga1: null })).toBeNull();
  });

  it('maps probabilities to categories', () => {
    expect(categoryOf(0.1)).toBe('rendah');
    expect(categoryOf(0.3)).toBe('sedang');
    expect(categoryOf(0.65)).toBe('tinggi');
    expect(categoryOf(0.85)).toBe('sangat_tinggi');
  });

  it('reads past rain only from completed hours and splits forecast hours pro rata', () => {
    const r = { startMs: [0, 3_600_000], mm: [6, 12] };
    expect(rainPastMm(r, 3_600_000 + 30 * MIN, 1)).toBe(6); // second hour still running
    expect(rainPastMm(r, 7_200_000, 3)).toBe(18);
    expect(rainBetweenMm(r, 30 * MIN, 90 * MIN)).toBeCloseTo(9);
  });
});

describe('scenario run', () => {
  it('is deterministic (same input, same output)', () => {
    const again = runScenario(JSON.parse(JSON.stringify(SCENARIO_DATA)));
    expect(JSON.stringify(again)).toBe(JSON.stringify(run));
  });

  it('covers the window at 10-minute steps with one cell per lead per polder', () => {
    expect(run.steps).toBe(361);
    for (const k of [0, 180, 360]) {
      expect(run.nowcast[k]).toHaveLength(SCENARIO_DATA.polders.length);
      for (const cells of run.nowcast[k]) expect(cells.map((c) => c.leadMin)).toEqual([60, 120, 180]);
    }
  });

  it('is monotonic in rain over the whole replay (base rule, blind-spot polder)', () => {
    const wetter = runScenario(scaleRain(SCENARIO_DATA, 1.5));
    const pi = SCENARIO_DATA.polders.findIndex((p) => p.id === 'pulomas');
    for (let k = 0; k < run.steps; k += 1) {
      for (let l = 0; l < 3; l += 1) {
        expect(wetter.nowcast[k][pi][l].probability).toBeGreaterThanOrEqual(run.nowcast[k][pi][l].probability - 1e-9);
      }
    }
  });

  it('gives probabilities that do not decrease with lead time', () => {
    for (const step of run.nowcast) {
      for (const cells of step) {
        expect(cells[1].probability).toBeGreaterThanOrEqual(cells[0].probability);
        expect(cells[2].probability).toBeGreaterThanOrEqual(cells[1].probability);
      }
    }
  });

  it('labels every simulated output with demo-rule-v1', () => {
    for (const c of run.nowcast[200].flat()) {
      expect(c.provenance).toMatchObject({ kind: 'simulated', modelVersion: 'demo-rule-v1' });
    }
    for (const s of run.status[200]) expect(s.provenance.kind).toBe('simulated');
    for (const r of run.recommendations) expect(r.provenance.kind).toBe('simulated');
  });

  it('drops the level term for stuck sensors and says so', () => {
    const pi = SCENARIO_DATA.polders.findIndex((p) => p.id === 'pulomas');
    const reasons = run.nowcast[200][pi][1].reasons.join(' | ');
    expect(reasons).toContain('Pompa Yos Sudarso 1 tidak dipakai');
    expect(reasons).toContain('sensor diduga macet');
    expect(reasons).not.toMatch(/TMA Pompa Yos Sudarso 1 \d/);
  });

  it('marks the drawdown state and keeps sump fill in range', () => {
    for (const step of run.status) {
      for (const s of step) {
        expect(s.sumpFillPct).toBeGreaterThanOrEqual(0);
        expect(s.sumpFillPct).toBeLessThanOrEqual(100);
        expect(['wet', 'dry']).toContain(s.drawdownState);
        expect(s.pumpsOn).toBeLessThanOrEqual(s.pumpsTotal);
      }
    }
    expect(run.status.some((step) => step.some((s) => s.drawdownState === 'wet'))).toBe(true);
  });
});

describe('recommendations', () => {
  it('produces each action type somewhere in the scenario', () => {
    const types = new Set(run.recommendations.map((r) => r.actionType));
    for (const t of ['drawdown', 'mobile_pump', 'crew', 'gate_watch', 'inspect_pump']) expect(types.has(t as never)).toBe(true);
  });

  it('respects the rate limit: one per polder per 30 min unless the category changes', () => {
    const byPolder = new Map<string, typeof run.recommendations>();
    for (const r of run.recommendations) byPolder.set(r.polderId, [...(byPolder.get(r.polderId) ?? []), r]);
    for (const recs of byPolder.values()) {
      for (let i = 1; i < recs.length; i += 1) {
        const gap = (Date.parse(recs[i].provenance.ts) - Date.parse(recs[i - 1].provenance.ts)) / MIN;
        expect(gap).toBeGreaterThan(0);
        if (gap < RATE_LIMIT_MIN) {
          const cat = (r: (typeof recs)[number]) => {
            const k = run.recommendationStep[run.recommendations.indexOf(r)];
            const pi = SCENARIO_DATA.polders.findIndex((p) => p.id === r.polderId);
            return run.nowcast[k][pi][1].category;
          };
          expect(cat(recs[i])).not.toBe(cat(recs[i - 1]));
        }
      }
    }
  });

  it('writes WhatsApp text with the SIMULASI prefix, the advice sentence, WIB window and dashboard link', () => {
    expect(run.recommendations.length).toBeGreaterThan(0);
    for (const r of run.recommendations) {
      expect(r.whatsappText.startsWith(WHATSAPP_PREFIX)).toBe(true);
      expect(r.whatsappText).toContain('SIMULASI');
      expect(r.whatsappText).toContain(ADVICE_SENTENCE);
      expect(r.whatsappText).toContain(`/operator/polder/${r.polderId}`);
      expect(r.whatsappText).toMatch(/\d{2}:\d{2}.*WIB/);
      expect(r.whatsappText).toContain(`${Math.round(r.probability * 100)}%`);
    }
    expect(WHATSAPP_PREFIX).toBe('[SIMULASI – Skenario 1 Jan 2020]');
  });

  it('issues no recommendation before its trigger condition holds', () => {
    run.recommendations.forEach((r, i) => {
      const k = run.recommendationStep[i];
      expect(Date.parse(r.provenance.ts)).toBe(run.startMs + k * run.stepMs);
      expect(Date.parse(r.windowStart)).toBeGreaterThanOrEqual(Date.parse(r.provenance.ts));
      const pi = SCENARIO_DATA.polders.findIndex((p) => p.id === r.polderId);
      const cells = run.nowcast[k][pi];
      const st = run.status[k][pi];
      if (r.actionType === 'drawdown') {
        expect(cells[1].probability).toBeGreaterThanOrEqual(TRIGGER_THRESHOLDS.drawdownP120);
        expect(st.sumpFillPct).toBeGreaterThan(TRIGGER_THRESHOLDS.drawdownSumpFillPct);
      }
      if (r.actionType === 'crew') expect(cells[1].probability).toBeGreaterThanOrEqual(TRIGGER_THRESHOLDS.crewP120);
      if (r.actionType === 'mobile_pump') expect(cells[1].probability).toBeGreaterThanOrEqual(TRIGGER_THRESHOLDS.mobilePumpP120);
      if (r.actionType === 'inspect_pump') expect(st.anomalies.some((a) => a.includes('aturan anomali 1'))).toBe(true);
      if (r.actionType === 'gate_watch') expect(r.polderId).toBe('setiabudi_timur');
    });
    // Nothing fires before the rain or the archive gives a reason: the first step is quiet.
    expect(run.recommendationStep[0]).toBeGreaterThan(0);
  });

  it('never repeats an open action for a polder unless the category escalates', () => {
    const open = new Map<string, { end: number; rank: number }>();
    run.recommendations.forEach((r, i) => {
      const key = `${r.polderId}|${r.actionType}`;
      const t = Date.parse(r.provenance.ts);
      const pi = SCENARIO_DATA.polders.findIndex((p) => p.id === r.polderId);
      const rank = CATEGORY_RANK[run.nowcast[run.recommendationStep[i]][pi][1].category];
      const prev = open.get(key);
      if (prev && prev.end > t) expect(rank).toBeGreaterThan(prev.rank);
      open.set(key, { end: Date.parse(r.windowEnd), rank });
    });
  });
});

describe('moments', () => {
  it('derives the key moments from the data', () => {
    const labels = run.moments.map((m) => m.label).join('\n');
    expect(labels).toContain('Puncak Manggarai 969 cm, Siaga 1');
    expect(labels).toContain('Depok mencapai Siaga 3');
    expect(labels).toContain('Katulampa naik cepat');
    expect(labels).toContain('Puncak hujan ERA5');
    const peak = run.moments.find((m) => m.label.startsWith('Puncak Manggarai'));
    expect(peak?.ts).toBe('2020-01-01T17:40:00.000Z');
    for (const m of run.moments) {
      expect((Date.parse(m.ts) - run.startMs) % run.stepMs).toBe(0);
    }
  });
});
