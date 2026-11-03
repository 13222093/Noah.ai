// components/operator/ops/meta.ts
//
// Display metadata for the operator screens: risk and Siaga colours (with
// text labels, never colour alone), provenance labels and the plain-language
// names of actions, recipients and operator responses. Bahasa Indonesia.
//
// Colours are the namespaced operator tokens (`--op-*` in app/globals.css,
// `op-*` classes in tailwind.config.ts), mapped to the original Noah status
// colours; this file maps meaning to token names and never holds raw hex.
// Every use of a risk or Siaga colour also shows the text label.

import type {
  ActionType,
  LeadMin,
  NowcastCell,
  OperatorAction,
  PolderSnapshot,
  ProvenanceKind,
  QualityFlag,
  Recipient,
  RiskCategory,
  SiagaLevel,
} from '@/lib/ops/types';
import { Archive, FlaskConical, Globe2, Radio, type LucideIcon } from 'lucide-react';

/**
 * CSS colour for an operator design token (the `--op-*` block in
 * app/globals.css), for places that need a colour string rather than a class:
 * SVG (recharts, Leaflet paths), inline styles and Leaflet divIcon HTML.
 * Pass the token name without the prefix, e.g. tokenColor("risk-tinggi").
 */
export function tokenColor(token: string, alpha?: number): string {
  return alpha === undefined ? `rgb(var(--op-${token}))` : `rgb(var(--op-${token}) / ${alpha})`;
}

export interface ScaleMeta {
  label: string;
  short: string;
  /** Design token name of the scale colour (see tokenColor). */
  token: string;
  /** Fill / swatch colour (CSS colour from the token). */
  color: string;
  /** Text colour that reads on top of `color`. */
  onColor: string;
  /**
   * Tailwind classes for a chip: tinted fill and border in the scale colour,
   * text in the neutral foreground so it passes AA in both themes.
   */
  chip: string;
}

function scale(label: string, short: string, token: string, chip: string): ScaleMeta {
  return { label, short, token, color: tokenColor(token), onColor: tokenColor(`on-${token}`), chip };
}

export const RISK_ORDER: RiskCategory[] = ['rendah', 'sedang', 'tinggi', 'sangat_tinggi'];

/**
 * Polder circles: 1.5px stroke in the risk colour, fill at a modest opacity
 * that rises a little with the category so the order survives at a glance.
 */
export const RISK_META: Record<RiskCategory, ScaleMeta & { weight: number; fillOpacity: number }> = {
  rendah: {
    ...scale('Rendah', 'R', 'risk-rendah', 'border-op-risk-rendah/60 bg-op-risk-rendah/10 text-op-fg'),
    weight: 1.5,
    fillOpacity: 0.16,
  },
  sedang: {
    ...scale('Sedang', 'S', 'risk-sedang', 'border-op-risk-sedang/70 bg-op-risk-sedang/[0.15] text-op-fg'),
    weight: 1.5,
    fillOpacity: 0.2,
  },
  tinggi: {
    ...scale('Tinggi', 'T', 'risk-tinggi', 'border-op-risk-tinggi/70 bg-op-risk-tinggi/[0.15] text-op-fg'),
    weight: 1.5,
    fillOpacity: 0.24,
  },
  sangat_tinggi: {
    ...scale('Sangat tinggi', 'ST', 'risk-sangat-tinggi', 'border-op-risk-sangat-tinggi/80 bg-op-risk-sangat-tinggi/20 text-op-fg'),
    weight: 1.5,
    fillOpacity: 0.28,
  },
};

/** Neutral fill for "no forecast yet" (bars, tiles, circles). */
export const NO_DATA_COLOR = tokenColor('fg-disabled');

export const SIAGA_ORDER: SiagaLevel[] = ['normal', 'siaga3', 'siaga2', 'siaga1', 'unknown'];

/** Status colours of the original Noah app: Normal green, then orange to red as levels rise. */
export const SIAGA_META: Record<SiagaLevel, ScaleMeta> = {
  normal: scale('Normal', 'N', 'siaga-normal', 'border-op-siaga-normal/60 bg-op-siaga-normal/10 text-op-fg'),
  siaga3: scale('Siaga 3', '3', 'siaga-3', 'border-op-siaga-3/70 bg-op-siaga-3/[0.15] text-op-fg'),
  siaga2: scale('Siaga 2', '2', 'siaga-2', 'border-op-siaga-2/70 bg-op-siaga-2/[0.15] text-op-fg'),
  siaga1: scale('Siaga 1', '1', 'siaga-1', 'border-op-siaga-1/80 bg-op-siaga-1/20 text-op-fg'),
  unknown: scale('Tidak diketahui', '?', 'siaga-unknown', 'border-op-border-strong bg-transparent text-op-fg-3'),
};

/** Threshold line colours for charts (Siaga 3/2/1). */
export const SIAGA_LINE: Record<'siaga3' | 'siaga2' | 'siaga1', string> = {
  siaga3: SIAGA_META.siaga3.color,
  siaga2: SIAGA_META.siaga2.color,
  siaga1: SIAGA_META.siaga1.color,
};

/**
 * Chart colours (recharts). Series are neutral; colour is kept for the Siaga
 * threshold lines and the "sekarang" marker (accent).
 */
export const CHART = {
  grid: tokenColor('border'),
  axis: tokenColor('fg-3'),
  /** Water level line. */
  level: tokenColor('fg'),
  /** Rain bars. */
  rain: tokenColor('fg-3'),
  /** Readings flagged as suspect or stale. */
  flagged: tokenColor('fg-3'),
  /** The replay-time marker. */
  now: tokenColor('accent'),
  cursor: tokenColor('fg-3'),
  tooltip: {
    backgroundColor: tokenColor('surface-2'),
    border: `1px solid ${tokenColor('border-strong')}`,
    borderRadius: 4,
    boxShadow: 'var(--op-shadow-popover)',
    color: tokenColor('fg'),
    fontSize: 12,
  },
  tooltipLabel: { color: tokenColor('fg'), fontWeight: 600 },
  tooltipItem: { color: tokenColor('fg-2') },
} as const;

export const QUALITY_LABEL: Record<QualityFlag, string> = {
  ok: 'Baik',
  suspect: 'Diragukan: sensor tidak berubah',
  stale: 'Data lama',
};

export const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  historical: 'Arsip historis',
  reanalysis: 'Reanalisis',
  simulated: 'SIMULASI',
  observed: 'Langsung',
};

/**
 * When a value counts as old, per kind of source: the DSDA archive reports
 * about every 30 min, ERA5 rain is hourly, forecasts are reissued every step.
 */
export const STALE_AFTER_MIN: Record<ProvenanceKind, number> = {
  historical: 45,
  reanalysis: 90,
  simulated: 15,
  observed: 15,
};

/**
 * Provenance chips. SIMULASI is the only coloured one (violet, outlined, no
 * fill flood); archive, reanalysis and live data are neutral outlines and
 * differ by icon (PROVENANCE_ICON) and label.
 */
export const PROVENANCE_CHIP: Record<ProvenanceKind, string> = {
  historical: 'border-op-border-strong bg-transparent text-op-fg-2',
  reanalysis: 'border-op-border-strong bg-transparent text-op-fg-2',
  simulated: 'border-op-sim bg-op-sim/10 text-op-sim',
  observed: 'border-op-border-strong bg-transparent text-op-fg-2',
};

export const PROVENANCE_ICON: Record<ProvenanceKind, LucideIcon> = {
  historical: Archive,
  reanalysis: Globe2,
  simulated: FlaskConical,
  observed: Radio,
};

export const ACTION_LABEL: Record<ActionType, string> = {
  drawdown: 'Turunkan muka air (drawdown)',
  mobile_pump: 'Kirim pompa mobile',
  crew: 'Siagakan Pasukan Biru',
  gate_watch: 'Pantau pintu air',
  inspect_pump: 'Periksa pompa',
};

export const RECIPIENT_LABEL: Record<Recipient, string> = {
  posko: 'Posko Banjir DSDA',
  pump_operator: 'Operator rumah pompa',
};

/** WhatsApp group shown in the preview, per recipient. */
export const RECIPIENT_GROUP: Record<Recipient, { name: string; members: string }> = {
  posko: {
    name: 'Posko Banjir DSDA – Operator',
    members: 'Noah AI, Koordinator Posko, Operator jaga, Pusdalops BPBD',
  },
  pump_operator: {
    name: 'Operator Rumah Pompa – DSDA',
    members: 'Noah AI, Kepala rumah pompa, Operator shift',
  },
};

export const OPERATOR_ACTION_META: Record<OperatorAction, { label: string; description: string; chip: string }> = {
  followed: {
    label: 'Ditindaklanjuti',
    description: 'Saran dijalankan atau sedang dijalankan.',
    chip: 'border-op-fg-2 bg-op-surface-3 text-op-fg',
  },
  deferred: {
    label: 'Ditunda',
    description: 'Dipantau dulu, keputusan diambil nanti.',
    chip: 'border-op-border-strong bg-op-surface-2 text-op-fg',
  },
  ignored: {
    label: 'Diabaikan',
    description: 'Tidak dijalankan, misalnya karena kondisi lapangan berbeda.',
    chip: 'border-op-border-strong bg-transparent text-op-fg-3',
  },
};

export function leadLabel(lead: LeadMin): string {
  return `${lead} mnt`;
}

/** "72%"; very small values read "<1%" so nothing looks certain. */
export function formatPct(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '–';
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p > 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

export function cellFor(snapshot: PolderSnapshot, lead: LeadMin): NowcastCell | null {
  return snapshot.nowcast.find((c) => c.leadMin === lead) ?? null;
}

export function riskRank(category: RiskCategory | null | undefined): number {
  return category ? RISK_ORDER.indexOf(category) : -1;
}

/** Plain-language name for a threshold source id (ids may be combined, e.g. "a + b"). */
export function thresholdSourceLabel(source: string): string {
  return source
    .replace(/dsda_official/g, 'resmi DSDA')
    .replace(/derived_from_S2_2020/g, 'diturunkan dari label arsip S2 2020, bukan angka resmi')
    .replace(/dsda_posko_banjir_page/g, 'halaman Posko Banjir DSDA');
}
