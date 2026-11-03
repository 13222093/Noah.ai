// lib/ops/demo/engine.ts
//
// SIMULASI engine for the 1 January 2020 replay. Deterministic and pure: the
// same ScenarioData always gives the same output; no randomness, no clock.
//
// Inputs that are REAL: water levels and DSDA Siaga status (S2 archive), hourly
// rain (Open-Meteo ERA5 reanalysis). Everything this file produces (nowcast,
// sump/pump status, recommendations) is SIMULATED by "demo-rule-v1", a
// transparent hand-set rule, not a validated or fitted model, and is never
// counted in any score (guardrail 5). Rule and assumptions are documented in
// docs/demo/simulation.md; keep the two in sync.

import { formatWibDate, formatWibTime, getWibParts } from '../../time';
import type {
  IsoUtc,
  LeadMin,
  NowcastCell,
  PolderStatus,
  Provenance,
  Recommendation,
  RiskCategory,
  ScenarioMoment,
} from '../types';
import { LEAD_TIMES } from '../types';
import type { ScenarioData, ScenarioPolder, ScenarioStation } from './data';
import { RATE_LIMIT_MIN, TRIGGERS, type TriggerContext } from './triggers';

export const RULE_VERSION = 'demo-rule-v1';
export const NOWCAST_SOURCE = 'Noah demo-rule-v1 (SIMULASI)';
export const STATUS_SOURCE = 'Simulasi neraca air kolam (demo-rule-v1)';
export const RECOMMENDATION_SOURCE = 'Tabel pemicu-tindakan plan 06 (SIMULASI)';
export const WHATSAPP_PREFIX = '[SIMULASI – Skenario 1 Jan 2020]';
export const ADVICE_SENTENCE = 'Saran: keputusan tetap di tangan operator.';

/**
 * demo-rule-v1 weights. logit = intercept + sum(weight * feature); p = 1/(1+e^-logit).
 * Hand-set so that the replay spans the categories; NOT fitted to flood events.
 * Rain weights are scaled for ERA5: a ~28 km cell average that, in this event,
 * peaks at 7 mm/h while BMKG recorded 377 mm/day at Halim. Per-mm weights for
 * gauge or radar rain would be several times smaller.
 */
export const NOWCAST_WEIGHTS = {
  intercept: -3.0,
  /** per mm of rain in the last completed hour (ERA5). */
  rainPast1hPerMm: 0.25,
  /** per mm of rain in the last 3 completed hours (ERA5). */
  rainPast3hPerMm: 0.1,
  /** per mm of "prakiraan hujan" inside the lead window (future ERA5, simulasi). */
  rainNextPerMm: 0.15,
  /** per unit of level index z = (cm - Siaga3) / (Siaga1 - Siaga3), 2020 thresholds, z clipped to [-1.5, 1.5]. */
  levelIndex: 2.0,
  /** per unit of rise index = rise (cm/h over ~60 min) / 50, clipped to [-0.5, 2]. */
  riseIndex: 0.6,
  /** per unit of upstream index per 60 min of lead (Ciliwung-linked polders only); index = clip(rise/50 cm/h, 0, 2) + 0.5 if >= Siaga 3. */
  upstreamPer60Min: 0.3,
  /** Pump-aware adjustment (plan 06 step 3), added to the logit. */
  pump: {
    sumpFullWithinLead: 1.0,
    sumpAbove90Pct: 0.5,
    pumpAnomaly: 0.5,
  },
  /** Linked posts farther than this get half weight on level and rise. */
  nearPostKm: 3,
} as const;

/** Category cut-offs on probability (lower bound inclusive). */
export const CATEGORY_CUTS: { min: number; category: RiskCategory }[] = [
  { min: 0.8, category: 'sangat_tinggi' },
  { min: 0.6, category: 'tinggi' },
  { min: 0.3, category: 'sedang' },
  { min: 0, category: 'rendah' },
];

/**
 * Sump simulation assumptions (plan 07 water balance). Every number here is a
 * PLACEHOLDER unless a source is named; replace with polder_params from DSDA.
 */
export const SIM_ASSUMPTIONS = {
  stepMin: 10,
  /** Urban runoff coefficient (placeholder). */
  runoffCoeff: 0.75,
  /** Catchment area, ha. Setiabudi Timur ~134 ha from R4 (polder_candidates.yaml c6); others placeholder. */
  catchmentHa: { setiabudi_timur: 134 } as Record<string, number>,
  defaultCatchmentHa: 150,
  /** Usable sump storage, m3 (placeholder, same for all). */
  sumpVolumeM3: 20000,
  initialFillPct: 20,
  /**
   * Capacity used for a pump whose capacity is unknown. Deliberately SMALL
   * (conservative: unknown capacity is not assumed to be enough), and so the
   * simulated sump responds to ERA5 rain at all. Not an estimate.
   */
  placeholderPumpM3s: 0.5,
  /** Capacity used for an aggregate "pumps unknown" entry (same reasoning). */
  placeholderAggregatePumpM3s: 1.0,
  /** Simulated operator policy: pump i switches on at 30 + 15*i % fill (max 85), all off at 15 %. */
  pumpOnPct: (i: number) => Math.min(30 + 15 * i, 85),
  pumpOffPct: 15,
  /** Plan 07 "wet" state: base P(120 or 180) >= this, or prakiraan hujan next 60 min >= wetRainMm. */
  wetProbability: 0.5,
  wetRainMm: 10,
  /** Anomaly rule 1: a pump on for >= minOnMin and outflow shortfall > shortfallFrac of expected. */
  anomaly: { minOnMin: 30, shortfallFrac: 0.25 },
  /**
   * Injected TRAINING fault (not a 2020 event): one pump delivers only
   * capacityFactor of its capacity from fromUtc, so the anomaly rule and the
   * "inspect pump" recommendation can be shown. Disclosed in ScenarioInfo.
   */
  injectedFault: {
    polderId: 'setiabudi_timur',
    pumpId: 'setiabudi_timur_p1',
    fromUtc: '2019-12-31T17:00:00.000Z', // 1 Jan 2020 00:00 WIB
    capacityFactor: 0.4,
  },
} as const;

/** Upstream signal for Ciliwung-linked polders (plan 06 "gate watch"). */
export const UPSTREAM = {
  river: 'Ciliwung',
  stations: [
    // Travel times to Manggarai are DEMO ASSUMPTIONS that need DSDA confirmation.
    { id: 'katulampa', travelMinH: 6, travelMaxH: 9 },
    { id: 'depok', travelMinH: 3, travelMaxH: 5 },
  ],
  fastRiseCmPerH: 30,
  maxAgeMin: 90,
} as const;

/** A reading older than this is not used by the rule. */
export const LEVEL_MAX_AGE_MIN = 90;

const MIN = 60_000;
const HOUR = 3_600_000;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, d: number) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};
const iso = (ms: number): IsoUtc => new Date(ms).toISOString();
/** Indonesian decimal comma. */
export const fmtNum = (n: number, d = 0) => n.toFixed(d).replace('.', ',');

export function categoryOf(p: number): RiskCategory {
  for (const c of CATEGORY_CUTS) if (p >= c.min) return c.category;
  return 'rendah';
}

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  rendah: 'rendah',
  sedang: 'sedang',
  tinggi: 'tinggi',
  sangat_tinggi: 'sangat tinggi',
};

export const CATEGORY_RANK: Record<RiskCategory, number> = { rendah: 0, sedang: 1, tinggi: 2, sangat_tinggi: 3 };

const SIAGA_LABEL: Record<string, string> = {
  normal: 'Normal',
  siaga3: 'Siaga 3',
  siaga2: 'Siaga 2',
  siaga1: 'Siaga 1',
  unknown: 'status tidak diketahui',
};

const LEAD_LABEL: Record<LeadMin, string> = { 60: '1 jam', 120: '2 jam', 180: '3 jam' };

/** "1 Jan 2020, 01:10–03:10 WIB" (or both dates when the window crosses midnight WIB). */
export function formatWibWindow(startMs: number, endMs: number): string {
  const a = getWibParts(startMs);
  const b = getWibParts(endMs);
  const hhmm = (ms: number) => formatWibTime(ms).replace(' WIB', '');
  if (a.year === b.year && a.month === b.month && a.day === b.day) {
    return `${formatWibDate(startMs)}, ${hhmm(startMs)}–${hhmm(endMs)} WIB`;
  }
  return `${formatWibDate(startMs)} ${hhmm(startMs)} – ${formatWibDate(endMs)} ${hhmm(endMs)} WIB`;
}

// ---------------------------------------------------------------------------
// Indexed inputs
// ---------------------------------------------------------------------------

interface StationIdx {
  st: ScenarioStation;
  tsMs: number[];
  usable: boolean[]; // quality ok and cm not null
}

interface RainIdx {
  startMs: number[];
  mm: number[];
}

function indexStation(st: ScenarioStation): StationIdx {
  return {
    st,
    tsMs: st.series.map((p) => Date.parse(p.ts)),
    usable: st.series.map((p) => p.quality === 'ok' && p.cm !== null),
  };
}

/** Last index with ts <= t (optionally only usable points), or -1. */
function lastAtOrBefore(ix: StationIdx, tMs: number, usableOnly: boolean): number {
  let lo = 0;
  let hi = ix.tsMs.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ix.tsMs[mid] <= tMs) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (!usableOnly) return ans;
  while (ans >= 0 && !ix.usable[ans]) ans -= 1;
  return ans;
}

/** Latest usable reading within maxAgeMin of t, and its rise over ~60 min (cm/h). */
export function levelAt(
  ix: StationIdx,
  tMs: number,
  maxAgeMin = LEVEL_MAX_AGE_MIN,
): { cm: number; siaga: string; ageMin: number; riseCmPerH: number | null } | null {
  const i = lastAtOrBefore(ix, tMs, true);
  if (i < 0) return null;
  const ageMin = (tMs - ix.tsMs[i]) / MIN;
  if (ageMin > maxAgeMin) return null;
  const p = ix.st.series[i];
  // Rise: compare with the usable reading closest to 60 min earlier, 30..90 min back.
  let best = -1;
  let bestDist = Infinity;
  for (let j = i - 1; j >= 0; j -= 1) {
    const back = (ix.tsMs[i] - ix.tsMs[j]) / MIN;
    if (back > 90) break;
    if (back < 30 || !ix.usable[j]) continue;
    const d = Math.abs(back - 60);
    if (d < bestDist) {
      bestDist = d;
      best = j;
    }
  }
  const rise =
    best >= 0 ? ((p.cm as number) - (ix.st.series[best].cm as number)) / ((ix.tsMs[i] - ix.tsMs[best]) / HOUR) : null;
  return { cm: p.cm as number, siaga: p.siaga, ageMin, riseCmPerH: rise };
}

/** Level index z relative to the 2020 thresholds, or null if they are unknown. */
export function levelIndex(cm: number, th: { siaga3: number | null; siaga2: number | null; siaga1: number | null }): number | null {
  const { siaga3: s3, siaga2: s2, siaga1: s1 } = th;
  let z: number | null = null;
  if (s3 !== null && s1 !== null && s1 > s3) z = (cm - s3) / (s1 - s3);
  else if (s3 !== null && s2 !== null && s2 > s3) z = (cm - s3) / (2 * (s2 - s3));
  if (z === null) return null;
  return clip(z, -1.5, 1.5);
}

function indexRain(series: { ts: IsoUtc; mm: number }[]): RainIdx {
  return { startMs: series.map((r) => Date.parse(r.ts)), mm: series.map((r) => r.mm) };
}

/** Rain in the last `hours` COMPLETED hours before t (no peeking into the running hour). */
export function rainPastMm(r: RainIdx, tMs: number, hours: number): number {
  let s = 0;
  for (let i = 0; i < r.startMs.length; i += 1) {
    const end = r.startMs[i] + HOUR;
    if (end <= tMs && end > tMs - hours * HOUR) s += r.mm[i];
  }
  return s;
}

/** Rain over [fromMs, toMs), hours split pro rata (uniform within the hour). */
export function rainBetweenMm(r: RainIdx, fromMs: number, toMs: number): number {
  let s = 0;
  for (let i = 0; i < r.startMs.length; i += 1) {
    const a = Math.max(r.startMs[i], fromMs);
    const b = Math.min(r.startMs[i] + HOUR, toMs);
    if (b > a) s += (r.mm[i] * (b - a)) / HOUR;
  }
  return s;
}

// ---------------------------------------------------------------------------
// demo-rule-v1 nowcast
// ---------------------------------------------------------------------------

export interface NowcastFeatures {
  leadMin: LeadMin;
  rainPast1hMm: number;
  rainPast3hMm: number;
  /** "prakiraan hujan" inside the lead window (future ERA5, simulasi). */
  rainNextMm: number;
  /** null = term dropped (no usable post). */
  levelIndex: number | null;
  riseIndex: number | null;
  upstreamIndex: number | null;
}

export interface Term {
  key: string;
  contribution: number;
  reason: string | null;
}

/** Base logit and per-term contributions. Monotonic non-decreasing in every rain feature. */
export function baseTerms(f: NowcastFeatures): { logit: number; terms: Term[] } {
  const w = NOWCAST_WEIGHTS;
  const terms: Term[] = [
    { key: 'rain1h', contribution: w.rainPast1hPerMm * f.rainPast1hMm, reason: `Hujan 1 jam terakhir ${fmtNum(f.rainPast1hMm, 1)} mm (ERA5)` },
    { key: 'rain3h', contribution: w.rainPast3hPerMm * f.rainPast3hMm, reason: `Hujan 3 jam terakhir ${fmtNum(f.rainPast3hMm, 1)} mm (ERA5)` },
    {
      key: 'rainNext',
      contribution: w.rainNextPerMm * f.rainNextMm,
      reason: `Prakiraan hujan ${LEAD_LABEL[f.leadMin]} ke depan ${fmtNum(f.rainNextMm, 1)} mm (dari data reanalisis, simulasi)`,
    },
  ];
  if (f.levelIndex !== null) terms.push({ key: 'level', contribution: w.levelIndex * f.levelIndex, reason: null });
  if (f.riseIndex !== null) terms.push({ key: 'rise', contribution: w.riseIndex * f.riseIndex, reason: null });
  if (f.upstreamIndex !== null) {
    terms.push({ key: 'upstream', contribution: w.upstreamPer60Min * (f.leadMin / 60) * f.upstreamIndex, reason: null });
  }
  const logit = w.intercept + terms.reduce((a, t) => a + t.contribution, 0);
  return { logit, terms };
}

export function baseProbability(f: NowcastFeatures): number {
  return logistic(baseTerms(f).logit);
}

// ---------------------------------------------------------------------------
// Scenario run
// ---------------------------------------------------------------------------

export interface PolderSimSeries {
  fillPct: number[];
  inflowM3s: number[];
  outflowM3s: number[];
  pumpsOn: number[];
  overflowM3: number[];
}

export interface ScenarioRun {
  startMs: number;
  endMs: number;
  stepMs: number;
  steps: number;
  /** [step][polderIndex][leadIndex] */
  nowcast: NowcastCell[][][];
  /** [step][polderIndex] */
  status: PolderStatus[][];
  /** Ascending by issue time. */
  recommendations: Recommendation[];
  /** Step at which each recommendation was issued (same order). */
  recommendationStep: number[];
  sim: Record<string, PolderSimSeries>;
  moments: ScenarioMoment[];
  initialTs: IsoUtc;
}

function simProv(source: string, tMs: number): Provenance {
  return { kind: 'simulated', source, ts: iso(tMs), modelVersion: RULE_VERSION };
}

interface PumpSim {
  id: string;
  name: string;
  capM3s: number;
  known: boolean;
  on: boolean;
  onSinceMs: number | null;
}

function pumpsFor(p: ScenarioPolder): PumpSim[] {
  return p.pumps.map((pump) => ({
    id: pump.id,
    name: pump.name,
    capM3s:
      pump.capacityM3s ??
      (/_agg$/.test(pump.id) ? SIM_ASSUMPTIONS.placeholderAggregatePumpM3s : SIM_ASSUMPTIONS.placeholderPumpM3s),
    known: pump.capacityM3s !== null,
    on: false,
    onSinceMs: null,
  }));
}

function faultFactor(polderId: string, pumpId: string, tMs: number): number {
  const f = SIM_ASSUMPTIONS.injectedFault;
  return f.polderId === polderId && f.pumpId === pumpId && tMs >= Date.parse(f.fromUtc) ? f.capacityFactor : 1;
}

export interface WhatsappInput {
  polderName: string;
  polderId: string;
  probability: number;
  category: RiskCategory;
  leadMin: LeadMin;
  windowStartMs: number;
  windowEndMs: number;
  reason: string;
  action: string;
  recipientLabel: string;
}

export function buildWhatsappText(m: WhatsappInput): string {
  return [
    WHATSAPP_PREFIX,
    `Polder: ${m.polderName}`,
    `Untuk: ${m.recipientLabel}`,
    `Peluang banjir dalam ${LEAD_LABEL[m.leadMin]}: ${Math.round(m.probability * 100)}% (${CATEGORY_LABEL[m.category]})`,
    `Waktu: ${formatWibWindow(m.windowStartMs, m.windowEndMs)}`,
    `Alasan: ${m.reason}`,
    `Saran tindakan: ${m.action}`,
    ADVICE_SENTENCE,
    `Dasbor: /operator/polder/${m.polderId}`,
  ].join('\n');
}

const RECIPIENT_LABEL = { posko: 'Posko Banjir', pump_operator: 'Operator rumah pompa' } as const;

function compactUtc(ms: number): string {
  return iso(ms).replace(/[-:]/g, '').slice(0, 13); // 20200101T0310
}

export function runScenario(data: ScenarioData): ScenarioRun {
  const stepMs = data.stepMin * MIN;
  const startMs = Date.parse(data.window.start);
  const endMs = Date.parse(data.window.end);
  const steps = Math.floor((endMs - startMs) / stepMs) + 1;

  const stIdx = new Map<string, StationIdx>(data.stations.map((s) => [s.id, indexStation(s)]));
  const rainIdx = new Map<string, RainIdx>(data.polders.map((p) => [p.id, indexRain(data.rain[p.id]?.series ?? [])]));

  const nowcast: NowcastCell[][][] = [];
  const status: PolderStatus[][] = [];
  const recommendations: Recommendation[] = [];
  const recommendationStep: number[] = [];
  const sim: Record<string, PolderSimSeries> = {};

  const vMax = SIM_ASSUMPTIONS.sumpVolumeM3;
  const polderState = data.polders.map((p) => {
    const pumps = pumpsFor(p);
    const knownAll = pumps.length > 0 && pumps.every((x) => x.known);
    sim[p.id] = { fillPct: [], inflowM3s: [], outflowM3s: [], pumpsOn: [], overflowM3: [] };
    const linked = p.linkedPosts
      .map((lp) => ({ ...lp, ix: stIdx.get(lp.stationId) }))
      .filter((lp): lp is typeof lp & { ix: StationIdx } => lp.ix !== undefined);
    return {
      p,
      pumps,
      knownCapacityM3s: knownAll ? round(pumps.reduce((a, x) => a + x.capM3s, 0), 2) : null,
      simCapacityM3s: round(pumps.reduce((a, x) => a + x.capM3s, 0), 2),
      areaM2: (SIM_ASSUMPTIONS.catchmentHa[p.id] ?? SIM_ASSUMPTIONS.defaultCatchmentHa) * 10_000,
      v: (SIM_ASSUMPTIONS.initialFillPct / 100) * vMax,
      linked,
      ciliwung: linked.some((lp) => lp.ix.st.river === UPSTREAM.river),
      // Rolling window for anomaly rule 1: expected vs actual outflow volume per step.
      expectedOut: [] as number[],
      actualOut: [] as number[],
      lastIssueMs: null as number | null,
      lastCategory: null as RiskCategory | null,
      open: new Map<string, { until: number; category: RiskCategory }>(),
    };
  });

  const inflowAt = (st: (typeof polderState)[number], fromMs: number, toMs: number) => {
    const mm = rainBetweenMm(rainIdx.get(st.p.id) as RainIdx, fromMs, toMs);
    return ((mm / 1000) * st.areaM2 * SIM_ASSUMPTIONS.runoffCoeff) / ((toMs - fromMs) / 1000);
  };

  for (let k = 0; k < steps; k += 1) {
    const t = startMs + k * stepMs;
    const nowcastK: NowcastCell[][] = [];
    const statusK: PolderStatus[] = [];

    polderState.forEach((st) => {
      const { p } = st;
      const rain = rainIdx.get(p.id) as RainIdx;

      // ---- M3 water balance over (t - step, t] (SIMULATED) -------------------
      let qIn = 0;
      let qOut = 0;
      let overflow = 0;
      let anomaly: string | null = null;
      if (k > 0) {
        const fillPrev = (st.v / vMax) * 100;
        st.pumps.forEach((pump, i) => {
          if (!pump.on && fillPrev >= SIM_ASSUMPTIONS.pumpOnPct(i)) {
            pump.on = true;
            pump.onSinceMs = t - stepMs;
          } else if (pump.on && fillPrev <= SIM_ASSUMPTIONS.pumpOffPct) {
            pump.on = false;
            pump.onSinceMs = null;
          }
        });
        const dt = stepMs / 1000;
        qIn = inflowAt(st, t - stepMs, t);
        const nominal = st.pumps.reduce((a, x) => a + (x.on ? x.capM3s : 0), 0);
        const actual = st.pumps.reduce((a, x) => a + (x.on ? x.capM3s * faultFactor(p.id, x.id, t - stepMs) : 0), 0);
        const available = st.v + qIn * dt;
        const expectedVol = Math.min(nominal * dt, available);
        const actualVol = Math.min(actual * dt, available);
        st.v = available - actualVol;
        if (st.v > vMax) {
          overflow = st.v - vMax;
          st.v = vMax;
        }
        qOut = actualVol / dt;
        st.expectedOut.push(expectedVol);
        st.actualOut.push(actualVol);
        if (st.expectedOut.length > SIM_ASSUMPTIONS.anomaly.minOnMin / data.stepMin) {
          st.expectedOut.shift();
          st.actualOut.shift();
        }
        // Anomaly rule 1 (plan 07): a pump ON for >= N min and the sump not falling at the expected rate.
        const longOn = st.pumps.some((x) => x.on && x.onSinceMs !== null && t - x.onSinceMs >= SIM_ASSUMPTIONS.anomaly.minOnMin * MIN);
        const exp = st.expectedOut.reduce((a, x) => a + x, 0);
        const act = st.actualOut.reduce((a, x) => a + x, 0);
        if (longOn && exp > 0 && (exp - act) / exp > SIM_ASSUMPTIONS.anomaly.shortfallFrac) {
          const shortM3s = (exp - act) / (st.expectedOut.length * dt);
          const injected = p.id === SIM_ASSUMPTIONS.injectedFault.polderId ? ' Gangguan pompa ini disuntikkan untuk latihan, bukan kejadian 2020.' : '';
          anomaly = `Muka air kolam turun lebih lambat dari perkiraan: debit pompa kurang ~${fmtNum(shortM3s, 1)} m3/s dari kapasitas pompa yang menyala (aturan anomali 1, simulasi).${injected}`;
        }
      }
      const fillPct = (st.v / vMax) * 100;
      const pumpsOn = st.pumps.filter((x) => x.on).length;
      const nominalOn = st.pumps.reduce((a, x) => a + (x.on ? x.capM3s : 0), 0);
      const qInNext = inflowAt(st, t, t + HOUR);
      const net = qInNext - nominalOn;
      const timeToFullMin = st.v >= vMax ? 0 : net > 0.01 ? Math.round((vMax - st.v) / net / 60) : null;
      const s = sim[p.id];
      s.fillPct.push(round(fillPct, 1));
      s.inflowM3s.push(round(qIn, 3));
      s.outflowM3s.push(round(qOut, 3));
      s.pumpsOn.push(pumpsOn);
      s.overflowM3.push(round(overflow, 1));

      // ---- Features (only data at or before t, except the labelled rain "forecast") ----
      const r1 = rainPastMm(rain, t, 1);
      const r3 = rainPastMm(rain, t, 3);
      const dropped: string[] = [];
      let bestLevel: { z: number; name: string; cm: number; siaga: string; s3: number | null } | null = null;
      let bestRise: { idx: number; name: string; rate: number } | null = null;
      for (const lp of st.linked) {
        const name = lp.ix.st.name;
        if (lp.ix.st.qc.stuck) {
          const v = lp.ix.st.series.find((x) => x.cm !== null)?.cm;
          dropped.push(`TMA ${name} tidak dipakai: nilai konstan ${v ?? '?'} cm sepanjang kejadian (sensor diduga macet)`);
          continue;
        }
        const lv = levelAt(lp.ix, t);
        if (!lv) {
          dropped.push(`TMA ${name} tidak dipakai: tidak ada bacaan valid dalam ${LEVEL_MAX_AGE_MIN} menit terakhir`);
          continue;
        }
        const factor = lp.km > NOWCAST_WEIGHTS.nearPostKm ? 0.5 : 1;
        const z = levelIndex(lv.cm, lp.ix.st.thresholds);
        if (z === null) dropped.push(`TMA ${name}: ambang Siaga 2020 tidak diketahui, level tidak dipakai`);
        else if (!bestLevel || z * factor > bestLevel.z) {
          bestLevel = { z: z * factor, name, cm: lv.cm, siaga: lv.siaga, s3: lp.ix.st.thresholds.siaga3 };
        }
        if (lv.riseCmPerH !== null) {
          const ri = clip(lv.riseCmPerH / 50, -0.5, 2) * factor;
          if (!bestRise || ri > bestRise.idx) bestRise = { idx: ri, name, rate: lv.riseCmPerH };
        }
      }
      if (st.linked.length === 0) dropped.push('Tidak ada pos TMA terkait; level dan kenaikan tidak dipakai');
      let upstreamIndex: number | null = null;
      let upstreamBest: { name: string; rate: number; siaga: string; travelMinH: number; travelMaxH: number } | null = null;
      if (st.ciliwung) {
        for (const u of UPSTREAM.stations) {
          const ix = stIdx.get(u.id);
          if (!ix || ix.st.qc.stuck) continue;
          const lv = levelAt(ix, t, UPSTREAM.maxAgeMin);
          if (!lv) continue;
          const s3 = ix.st.thresholds.siaga3;
          const idx = clip((lv.riseCmPerH ?? 0) / 50, 0, 2) + (s3 !== null && lv.cm >= s3 ? 0.5 : 0);
          upstreamIndex = Math.max(upstreamIndex ?? 0, idx);
          const rate = lv.riseCmPerH ?? 0;
          if (rate >= UPSTREAM.fastRiseCmPerH && (!upstreamBest || rate > upstreamBest.rate)) {
            upstreamBest = { name: ix.st.name, rate, siaga: lv.siaga, travelMinH: u.travelMinH, travelMaxH: u.travelMaxH };
          }
        }
      }

      // ---- Nowcast per lead (base rule, then pump-aware adjustment) ----------
      const base = LEAD_TIMES.map((L) => {
        const f: NowcastFeatures = {
          leadMin: L,
          rainPast1hMm: r1,
          rainPast3hMm: r3,
          rainNextMm: rainBetweenMm(rain, t, t + L * MIN),
          levelIndex: bestLevel ? bestLevel.z : null,
          riseIndex: bestRise ? bestRise.idx : null,
          upstreamIndex,
        };
        return { L, f, ...baseTerms(f) };
      });
      const wet =
        logistic(base[1].logit) >= SIM_ASSUMPTIONS.wetProbability ||
        logistic(base[2].logit) >= SIM_ASSUMPTIONS.wetProbability ||
        rainBetweenMm(rain, t, t + HOUR) >= SIM_ASSUMPTIONS.wetRainMm;

      const cells: NowcastCell[] = base.map(({ L, f, logit, terms }) => {
        const all: Term[] = terms.map((tm) => {
          if (tm.key === 'level' && bestLevel) {
            const th = bestLevel.s3 !== null ? `; Siaga 3 (2020) ${bestLevel.s3} cm` : '';
            return { ...tm, reason: `TMA ${bestLevel.name} ${fmtNum(bestLevel.cm)} cm, ${SIAGA_LABEL[bestLevel.siaga]} menurut DSDA${th}` };
          }
          if (tm.key === 'rise' && bestRise) {
            const verb = bestRise.rate >= 0 ? 'naik' : 'turun';
            return { ...tm, reason: `TMA ${bestRise.name} ${verb} ${fmtNum(Math.abs(bestRise.rate))} cm/jam` };
          }
          if (tm.key === 'upstream') {
            return { ...tm, reason: `Hulu Ciliwung (Katulampa/Depok) naik atau di atas Siaga 3` };
          }
          return tm;
        });
        let adj = 0;
        if (timeToFullMin !== null && timeToFullMin <= L) {
          adj += NOWCAST_WEIGHTS.pump.sumpFullWithinLead;
          all.push({
            key: 'pumpFull',
            contribution: NOWCAST_WEIGHTS.pump.sumpFullWithinLead,
            reason: timeToFullMin === 0 ? 'Kolam penampung penuh (simulasi)' : `Kolam penampung diperkirakan penuh dalam ${timeToFullMin} menit (simulasi)`,
          });
        }
        if (fillPct >= 90) {
          adj += NOWCAST_WEIGHTS.pump.sumpAbove90Pct;
          all.push({ key: 'pump90', contribution: NOWCAST_WEIGHTS.pump.sumpAbove90Pct, reason: `Kolam terisi ${Math.round(fillPct)}% (simulasi)` });
        }
        if (anomaly) {
          adj += NOWCAST_WEIGHTS.pump.pumpAnomaly;
          all.push({ key: 'pumpAnomaly', contribution: NOWCAST_WEIGHTS.pump.pumpAnomaly, reason: 'Ada anomali pompa (simulasi)' });
        }
        const prob = round(logistic(logit + adj), 3);
        const reasons = all
          .filter((tm) => tm.reason !== null && tm.contribution >= 0.15)
          .sort((a, b) => b.contribution - a.contribution || a.key.localeCompare(b.key))
          .map((tm) => tm.reason as string)
          .slice(0, 4);
        const negative = all.filter((tm) => tm.reason !== null && tm.contribution <= -0.3).map((tm) => `${tm.reason} (menurunkan peluang)`);
        if (reasons.length === 0) reasons.push(f.rainPast3hMm < 1 && f.rainNextMm < 1 ? 'Tidak ada hujan berarti dan TMA terkait tidak tinggi' : 'Tidak ada faktor dominan');
        return {
          polderId: p.id,
          leadMin: L,
          probability: prob,
          category: categoryOf(prob),
          reasons: [...reasons, ...negative.slice(0, 1), ...dropped],
          validFrom: iso(t),
          validTo: iso(t + L * MIN),
          provenance: simProv(NOWCAST_SOURCE, t),
        };
      });
      nowcastK.push(cells);

      const anomalies: string[] = [];
      for (const lp of st.linked) if (lp.ix.st.qc.stuck) anomalies.push(`Sensor TMA ${lp.ix.st.name} macet (nilai konstan): titik buta data.`);
      if (anomaly) anomalies.push(anomaly);
      if (overflow > 0) anomalies.push(`Kolam penuh; ~${fmtNum(overflow)} m3 meluap dalam 10 menit terakhir (simulasi).`);
      statusK.push({
        polderId: p.id,
        sumpFillPct: round(fillPct, 1),
        timeToFullMin,
        pumpsOn,
        pumpsTotal: st.pumps.length,
        anomalies,
        provenance: simProv(STATUS_SOURCE, t),
        drawdownState: wet ? 'wet' : 'dry',
        inflowM3s: round(qIn, 2),
        outflowM3s: round(qOut, 2),
      });

      // ---- Recommendations (trigger table + rate limit) ---------------------
      const c120 = cells[1];
      const ctx: TriggerContext = {
        polderId: p.id,
        polderName: p.name,
        p120: c120.probability,
        p180: cells[2].probability,
        category120: c120.category,
        reasons120: c120.reasons,
        sumpFillPct: fillPct,
        timeToFullMin,
        pumpsOn,
        pumpsTotal: st.pumps.length,
        knownCapacityM3s: st.knownCapacityM3s,
        simCapacityM3s: st.simCapacityM3s,
        peakInflowNext120M3s: Math.max(inflowAt(st, t, t + HOUR), inflowAt(st, t + HOUR, t + 2 * HOUR)),
        rainPast3hMm: r3,
        wet,
        anomaly,
        upstream: upstreamBest
          ? {
              stationName: upstreamBest.name,
              rateCmPerH: upstreamBest.rate,
              siagaLabel: SIAGA_LABEL[upstreamBest.siaga],
              gateName: st.linked.find((lp) => lp.ix.st.river === UPSTREAM.river)?.ix.st.name ?? 'pintu air hilir',
              travelMinH: upstreamBest.travelMinH,
              travelMaxH: upstreamBest.travelMaxH,
            }
          : null,
      };
      const categoryChanged = st.lastCategory !== null && st.lastCategory !== c120.category;
      const rateLimited = st.lastIssueMs !== null && t - st.lastIssueMs < RATE_LIMIT_MIN * MIN && !categoryChanged;
      if (!rateLimited) {
        // A trigger whose recommendation is still open is repeated only if the category escalated.
        const fired = TRIGGERS.filter((tr) => tr.when(ctx))
          .filter((tr) => {
            const o = st.open.get(tr.actionType);
            return !o || o.until <= t || CATEGORY_RANK[c120.category] > CATEGORY_RANK[o.category];
          })
          .sort((a, b) => a.priority - b.priority);
        const tr = fired[0];
        if (tr) {
          const w = tr.window(ctx);
          const cell = cells[LEAD_TIMES.indexOf(tr.leadMin)];
          const ws = t + w.startMin * MIN;
          const we = t + w.endMin * MIN;
          const reason = tr.reason(ctx);
          const action = tr.action(ctx);
          recommendations.push({
            id: `${p.id}-${tr.actionType}-${compactUtc(t)}`,
            polderId: p.id,
            actionType: tr.actionType,
            recipient: tr.recipient,
            title: tr.title(ctx),
            reason,
            probability: cell.probability,
            leadMin: tr.leadMin,
            windowStart: iso(ws),
            windowEnd: iso(we),
            whatsappText: buildWhatsappText({
              polderName: p.name,
              polderId: p.id,
              probability: cell.probability,
              category: cell.category,
              leadMin: tr.leadMin,
              windowStartMs: ws,
              windowEndMs: we,
              reason,
              action,
              recipientLabel: RECIPIENT_LABEL[tr.recipient],
            }),
            provenance: simProv(RECOMMENDATION_SOURCE, t),
          });
          recommendationStep.push(k);
          st.lastIssueMs = t;
          st.lastCategory = c120.category;
          st.open.set(tr.actionType, { until: Math.max(we, t + (tr.repeatAfterMin ?? 0) * MIN), category: c120.category });
        }
      }
    });

    nowcast.push(nowcastK);
    status.push(statusK);
  }

  const moments = deriveMoments(data, recommendations, startMs, stepMs, endMs);
  return {
    startMs,
    endMs,
    stepMs,
    steps,
    nowcast,
    status,
    recommendations,
    recommendationStep,
    sim,
    moments,
    initialTs: suggestInitial(data, startMs, stepMs),
  };
}

// ---------------------------------------------------------------------------
// Timeline moments, derived from the data (never hand-typed)
// ---------------------------------------------------------------------------

/** Rise rate that marks the "Katulampa naik cepat" moment (cm/h between consecutive readings). */
export const KATULAMPA_FAST_RISE_CM_PER_H = 50;

const ceilToStep = (ms: number, startMs: number, stepMs: number) => startMs + Math.ceil((ms - startMs) / stepMs) * stepMs;

function firstSiaga(st: ScenarioStation | undefined, levels: string[]) {
  return st?.series.find((p) => p.quality === 'ok' && levels.includes(p.siaga)) ?? null;
}

export function deriveMoments(
  data: ScenarioData,
  recs: Recommendation[],
  startMs: number,
  stepMs: number,
  endMs: number,
): ScenarioMoment[] {
  const out: ScenarioMoment[] = [];
  const byId = new Map(data.stations.map((s) => [s.id, s]));
  const snap = (ts: IsoUtc) => iso(Math.min(ceilToStep(Date.parse(ts), startMs, stepMs), endMs));
  const fmtT = (ts: IsoUtc) => formatWibTime(ts);

  const mg = byId.get('manggarai');
  if (mg?.series.length) {
    out.push({ ts: snap(mg.series[0].ts), label: `Arsip TMA DSDA mulai (${fmtT(mg.series[0].ts)})`, stationId: 'manggarai' });
  }

  // Peak ERA5 rain hour across the polder reference points.
  let peak: { ts: IsoUtc; mm: number; polderId: string } | null = null;
  for (const p of data.polders) {
    for (const r of data.rain[p.id]?.series ?? []) {
      const ms = Date.parse(r.ts);
      if (ms < startMs || ms > endMs) continue;
      if (!peak || r.mm > peak.mm) peak = { ts: r.ts, mm: r.mm, polderId: p.id };
    }
  }
  if (peak && peak.mm > 0) {
    const endHour = Date.parse(peak.ts) + HOUR;
    out.push({
      ts: snap(iso(endHour)),
      label: `Puncak hujan ERA5 ${fmtNum(peak.mm, 1)} mm/jam (${fmtT(peak.ts).replace(' WIB', '')}–${fmtT(iso(endHour))})`,
      polderId: peak.polderId,
    });
  }

  const dp = firstSiaga(byId.get('depok'), ['siaga3', 'siaga2', 'siaga1']);
  if (dp) out.push({ ts: snap(dp.ts), label: `Depok mencapai Siaga 3 (${fmtNum(dp.cm ?? 0)} cm, ${fmtT(dp.ts)})`, stationId: 'depok' });

  const kt = byId.get('katulampa');
  if (kt) {
    for (let i = 1; i < kt.series.length; i += 1) {
      const a = kt.series[i - 1];
      const b = kt.series[i];
      if (a.cm === null || b.cm === null || a.quality !== 'ok' || b.quality !== 'ok') continue;
      const dh = (Date.parse(b.ts) - Date.parse(a.ts)) / HOUR;
      if (dh > 0 && dh <= 1 && (b.cm - a.cm) / dh >= KATULAMPA_FAST_RISE_CM_PER_H) {
        out.push({ ts: snap(b.ts), label: `Katulampa naik cepat (${fmtNum(a.cm)} → ${fmtNum(b.cm)} cm, ${fmtT(b.ts)})`, stationId: 'katulampa' });
        break;
      }
    }
  }

  if (mg) {
    const s3 = firstSiaga(mg, ['siaga3', 'siaga2', 'siaga1']);
    if (s3) out.push({ ts: snap(s3.ts), label: `Manggarai masuk Siaga 3 (${fmtNum(s3.cm ?? 0)} cm, ${fmtT(s3.ts)})`, stationId: 'manggarai' });
    const s1 = firstSiaga(mg, ['siaga1']);
    if (s1) out.push({ ts: snap(s1.ts), label: `Manggarai masuk Siaga 1 (${fmtNum(s1.cm ?? 0)} cm, ${fmtT(s1.ts)})`, stationId: 'manggarai' });
    let top = mg.series[0];
    for (const p of mg.series) if (p.quality === 'ok' && (p.cm ?? -Infinity) > (top.cm ?? -Infinity)) top = p;
    if (top) {
      out.push({
        ts: snap(top.ts),
        label: `Puncak Manggarai ${fmtNum(top.cm ?? 0)} cm, ${SIAGA_LABEL[top.siaga]} (${formatWibDate(top.ts)} ${fmtT(top.ts)})`,
        stationId: 'manggarai',
      });
    }
  }

  if (recs.length) {
    const r = recs[0];
    out.push({ ts: r.provenance.ts, label: `Rekomendasi simulasi pertama (${fmtT(r.provenance.ts)})`, polderId: r.polderId });
  }
  return out.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.label.localeCompare(b.label));
}

/**
 * Open the replay where the DSDA archive starts for most posts (first
 * Manggarai reading, on the step grid). Before that only rain is available.
 */
function suggestInitial(data: ScenarioData, startMs: number, stepMs: number): IsoUtc {
  const first = data.stations.find((s) => s.id === 'manggarai')?.series[0];
  if (!first) return iso(startMs);
  return iso(ceilToStep(Date.parse(first.ts), startMs, stepMs));
}
