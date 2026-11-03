// lib/ops/demo/triggers.ts
//
// Trigger-to-action table (docs/plan/06_MODULE_2_IMPACT_NOWCAST.md,
// "Recommendations"), stored as configuration. SIMULASI: these fire on the
// demo rule's probabilities and the simulated sump, not on a validated model.
// Review with DSDA before any real use. Wording is advice (guardrail 16).

import type { ActionType, LeadMin, Recipient, RiskCategory } from '../types';

/** Everything a trigger may look at, computed by the engine at one step. */
export interface TriggerContext {
  polderId: string;
  polderName: string;
  /** Pump-aware probability within 120 and 180 min. */
  p120: number;
  p180: number;
  category120: RiskCategory;
  /** Top nowcast reasons at 120 min, Bahasa Indonesia. */
  reasons120: string[];
  sumpFillPct: number;
  timeToFullMin: number | null;
  pumpsOn: number;
  pumpsTotal: number;
  /** Sum of stated capacities; null when any stationary pump capacity is unknown. */
  knownCapacityM3s: number | null;
  /** Placeholder-or-stated capacity the simulation uses. */
  simCapacityM3s: number;
  /** Peak inflow expected over the next 120 min (simulated, m3/s). */
  peakInflowNext120M3s: number;
  rainPast3hMm: number;
  wet: boolean;
  /** Pump anomaly text when rule 1 fires (simulated sump), else null. */
  anomaly: string | null;
  /** Fast upstream rise on a Ciliwung-linked polder, else null. */
  upstream: {
    stationName: string;
    rateCmPerH: number;
    siagaLabel: string;
    gateName: string;
    travelMinH: number;
    travelMaxH: number;
  } | null;
}

export interface TriggerDef {
  id: string;
  actionType: ActionType;
  recipient: Recipient;
  /** Lower runs first when several fire in the same step for one polder. */
  priority: number;
  /** Lead time whose probability the message quotes. */
  leadMin: LeadMin;
  /**
   * Minimum minutes before the same action is issued again for the polder
   * (unless the category escalates). Defaults to the window end.
   */
  repeatAfterMin?: number;
  /** Window relative to issue time, minutes. */
  window: (ctx: TriggerContext) => { startMin: number; endMin: number };
  when: (ctx: TriggerContext) => boolean;
  title: (ctx: TriggerContext) => string;
  /** Suggested action sentence. */
  action: (ctx: TriggerContext) => string;
  /** Why, in plain language. */
  reason: (ctx: TriggerContext) => string;
}

/** Guardrail 17: at most one message per polder per 30 minutes unless the category changes. */
export const RATE_LIMIT_MIN = 30;

export const TRIGGER_THRESHOLDS = {
  drawdownP120: 0.6,
  drawdownSumpFillPct: 50,
  mobilePumpP120: 0.6,
  crewP120: 0.7,
  /** Rain over the past 3 h that counts as "during rain" for the anomaly trigger. */
  anomalyRainPast3hMm: 1,
  /** Mobile pump size used to size "N pompa mobile" (placeholder, documented). */
  mobilePumpM3s: 0.5,
  maxMobilePumps: 4,
} as const;

const num = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

function mobilePumpCount(ctx: TriggerContext): number {
  // Unknown capacity: size against the simulation placeholder (rough, says so in the reason).
  const deficit = ctx.peakInflowNext120M3s - (ctx.knownCapacityM3s ?? ctx.simCapacityM3s);
  const n = Math.ceil(Math.max(deficit, TRIGGER_THRESHOLDS.mobilePumpM3s) / TRIGGER_THRESHOLDS.mobilePumpM3s);
  return Math.min(Math.max(n, 1), TRIGGER_THRESHOLDS.maxMobilePumps);
}

function topReasons(ctx: TriggerContext, n = 2): string {
  return ctx.reasons120.slice(0, n).join('; ');
}

export const TRIGGERS: TriggerDef[] = [
  {
    id: 'pump_anomaly_during_rain',
    actionType: 'inspect_pump',
    recipient: 'pump_operator',
    priority: 1,
    leadMin: 60,
    window: () => ({ startMin: 0, endMin: 180 }),
    repeatAfterMin: 360, // one inspection request per fault episode, not every pump cycle
    when: (c) => c.anomaly !== null && (c.rainPast3hMm >= TRIGGER_THRESHOLDS.anomalyRainPast3hMm || c.wet),
    title: () => 'Periksa pompa: debit di bawah kapasitas',
    action: (c) => `Periksa pompa yang menyala saat rekomendasi terbit (${c.pumpsOn} dari ${c.pumpsTotal}): arus, putaran, saringan sampah.`,
    reason: (c) => `${c.anomaly} Hujan 3 jam terakhir ${num(c.rainPast3hMm)} mm.`,
  },
  {
    id: 'predrawdown',
    actionType: 'drawdown',
    recipient: 'pump_operator',
    priority: 2,
    leadMin: 120,
    window: () => ({ startMin: 0, endMin: 120 }),
    when: (c) => c.p120 >= TRIGGER_THRESHOLDS.drawdownP120 && c.sumpFillPct > TRIGGER_THRESHOLDS.drawdownSumpFillPct,
    title: () => 'Pertimbangkan menyalakan pompa lebih awal (drawdown)',
    action: () => 'Pertimbangkan menyalakan pompa sekarang untuk menurunkan muka air kolam sebelum hujan berikutnya.',
    reason: (c) =>
      `Kolam terisi ${Math.round(c.sumpFillPct)}% (simulasi)` +
      (c.timeToFullMin !== null ? `, penuh dalam ~${c.timeToFullMin} menit` : '') +
      `. ${topReasons(c)}.`,
  },
  {
    id: 'mobile_pump',
    actionType: 'mobile_pump',
    recipient: 'posko',
    priority: 3,
    leadMin: 120,
    when: (c) =>
      c.p120 >= TRIGGER_THRESHOLDS.mobilePumpP120 &&
      (c.pumpsTotal === 0 || c.knownCapacityM3s === null || c.peakInflowNext120M3s > c.knownCapacityM3s),
    window: () => ({ startMin: 0, endMin: 180 }),
    title: (c) => `Pertimbangkan mengirim ${mobilePumpCount(c)} pompa mobile`,
    action: (c) => `Pertimbangkan mengirim ${mobilePumpCount(c)} pompa mobile ke sekitar ${c.polderName} (titik acuan polder).`,
    reason: (c) =>
      (c.knownCapacityM3s === null
        ? `Kapasitas pompa stasioner belum diketahui (jumlah pompa mobile dihitung kasar dari nilai pengganti ${num(c.simCapacityM3s)} m3/s)`
        : `Perkiraan aliran masuk ${num(c.peakInflowNext120M3s)} m3/s melebihi kapasitas ${num(c.knownCapacityM3s)} m3/s`) +
      `. ${topReasons(c)}.`,
  },
  {
    id: 'crew_preposition',
    actionType: 'crew',
    recipient: 'posko',
    priority: 4,
    leadMin: 120,
    window: () => ({ startMin: 0, endMin: 180 }),
    repeatAfterMin: 240,
    // Plan 06 also requires "exposed population above threshold"; S14 exposure is not
    // available yet (scorecard c9 null for all), so the demo uses probability alone.
    when: (c) => c.p120 >= TRIGGER_THRESHOLDS.crewP120,
    title: () => 'Pertimbangkan menyiagakan Pasukan Biru',
    action: (c) => `Pertimbangkan menyiagakan regu Pasukan Biru di ${c.polderName}.`,
    reason: (c) => `${topReasons(c)}. Data paparan penduduk (S14) belum tersedia; pemicu memakai peluang saja.`,
  },
  {
    id: 'upstream_rise',
    actionType: 'gate_watch',
    recipient: 'posko',
    priority: 5,
    leadMin: 180,
    window: (c) => ({ startMin: (c.upstream?.travelMinH ?? 3) * 60, endMin: (c.upstream?.travelMaxH ?? 6) * 60 }),
    when: (c) => c.upstream !== null,
    title: (c) => `Pantau ${c.upstream?.gateName ?? 'pintu air hilir'}`,
    action: (c) =>
      `Pantau ${c.upstream?.gateName}; kenaikan di hilir diperkirakan dalam ~${c.upstream?.travelMinH}-${c.upstream?.travelMaxH} jam (asumsi waktu tempuh demo).`,
    reason: (c) => `${c.upstream?.stationName} naik ${Math.round(c.upstream?.rateCmPerH ?? 0)} cm/jam (${c.upstream?.siagaLabel}, data arsip DSDA).`,
  },
];
