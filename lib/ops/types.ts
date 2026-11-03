// lib/ops/types.ts
//
// Shared contract between the operator pages and their data provider.
// Pages read data only through the hooks in lib/ops/hooks.ts, which return
// these types. Today the provider is the 1 January 2020 historical replay
// (lib/ops/demo/); a live provider backed by the v1 API replaces it later
// without page changes.
//
// Conventions (CLAUDE.md, guardrails 5, 7, 8):
// - Every timestamp is an ISO 8601 string in UTC. Display in WIB via lib/time.
// - Water level in cm relative to the station datum, rain in mm, flow in m3/s.
// - Every value a user sees carries a Provenance; simulated or replayed values
//   say so, and the UI must label them (SimulasiBadge / scenario banner).

export type IsoUtc = string;

/** How a value came to be. The UI derives its label from `kind`. */
export type ProvenanceKind =
  | 'observed' // live measurement from a source (not used by the replay)
  | 'historical' // real archived measurement, replayed (S2 archive)
  | 'reanalysis' // real but coarse modelled observation (Open-Meteo ERA5)
  | 'simulated'; // produced by a demo rule, not a validated model

export interface Provenance {
  kind: ProvenanceKind;
  /** Short source name for the UI, e.g. "DSDA Posko Banjir (arsip S2)". */
  source: string;
  /** Time the value refers to (measurement time, or issue time for forecasts). */
  ts: IsoUtc;
  /** For simulated values: the rule or model version, e.g. "demo-rule-v1". */
  modelVersion?: string;
}

/** DSDA alert status at a water-level post, as recorded by DSDA. */
export type SiagaLevel = 'normal' | 'siaga3' | 'siaga2' | 'siaga1' | 'unknown';

export type QualityFlag = 'ok' | 'suspect' | 'stale';

export interface SiagaThresholdsCm {
  siaga3: number | null;
  siaga2: number | null;
  siaga1: number | null;
  /** Where the numbers come from, e.g. "dsda_official" or "derived_from_S2_2020". */
  source: string;
}

export interface Station {
  id: string;
  name: string;
  river: string;
  lat: number;
  lon: number;
  thresholds: SiagaThresholdsCm;
}

export interface LevelPoint {
  ts: IsoUtc;
  cm: number | null;
  /** Status DSDA recorded with this reading (real, from the archive). */
  siaga: SiagaLevel;
  quality: QualityFlag;
}

export interface RainPoint {
  ts: IsoUtc; // start of the hour
  mm: number; // rain during that hour
}

export interface Pump {
  id: string;
  name: string;
  capacityM3s: number | null; // null = unknown
}

export interface PolderUnit {
  id: string;
  name: string;
  /** Approximate reference point; real boundaries arrive with S8. */
  lat: number;
  lon: number;
  /** Radius for the map marker only; not a boundary. */
  displayRadiusM: number;
  /** Water-level posts linked to this polder (Station.id). */
  stationIds: string[];
  pumps: Pump[];
  /** Plain-language note shown in the UI, e.g. about data gaps. */
  note?: string;
}

export type LeadMin = 60 | 120 | 180;
export const LEAD_TIMES: readonly LeadMin[] = [60, 120, 180] as const;

export type RiskCategory = 'rendah' | 'sedang' | 'tinggi' | 'sangat_tinggi';

export interface NowcastCell {
  polderId: string;
  leadMin: LeadMin;
  /** 0..1, chance of flooding within the lead window. */
  probability: number;
  category: RiskCategory;
  /** Short reasons in Bahasa Indonesia, most important first. */
  reasons: string[];
  validFrom: IsoUtc;
  validTo: IsoUtc;
  provenance: Provenance; // issue time in provenance.ts
}

export interface PolderStatus {
  polderId: string;
  sumpFillPct: number | null;
  /** Minutes until the sump is full at forecast inflow; null if not filling. */
  timeToFullMin: number | null;
  pumpsOn: number;
  pumpsTotal: number;
  /** Plain-language anomalies, e.g. a stuck sensor. */
  anomalies: string[];
  provenance: Provenance;
  /** Optional (added for the replay): plan 07 drawdown state. "wet" = pre-emptive drawdown advised. */
  drawdownState?: 'wet' | 'dry';
  /** Optional: inflow and pump outflow at this time, m3/s. */
  inflowM3s?: number;
  outflowM3s?: number;
}

export type ActionType = 'drawdown' | 'mobile_pump' | 'crew' | 'gate_watch' | 'inspect_pump';
export type Recipient = 'posko' | 'pump_operator';

export interface Recommendation {
  id: string;
  polderId: string;
  actionType: ActionType;
  recipient: Recipient;
  /** Short imperative title in Bahasa Indonesia. */
  title: string;
  /** Why, in plain language. */
  reason: string;
  probability: number;
  leadMin: LeadMin;
  windowStart: IsoUtc;
  windowEnd: IsoUtc;
  /** Message text exactly as it would go to the operator WhatsApp group. */
  whatsappText: string;
  provenance: Provenance; // issue time in provenance.ts
}

export type OperatorAction = 'followed' | 'deferred' | 'ignored';

export interface Acknowledgement {
  recommendationId: string;
  at: IsoUtc;
  by: string;
  action: OperatorAction;
  note?: string;
}

export interface ConnectorHealth {
  id: string;
  label: string;
  newestTs: IsoUtc | null;
  ageMin: number | null;
  stale: boolean;
  provenance: Provenance;
}

/** A notable moment on the replay timeline, for "jump to" buttons. */
export interface ScenarioMoment {
  ts: IsoUtc;
  label: string;
  stationId?: string;
  polderId?: string;
}

export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
  start: IsoUtc;
  end: IsoUtc;
  stepMin: number;
  /** Optional (added for the replay): suggested time to open the replay at, before the event builds. */
  initialTs?: IsoUtc;
  moments: ScenarioMoment[];
  /** Plain-language list of what is real and what is simulated. */
  disclosure: string[];
}

export interface StationReading {
  station: Station;
  latest: LevelPoint | null;
  /** Minutes between the latest reading and the snapshot time. */
  ageMin: number | null;
  provenance: Provenance | null;
}

export interface PolderSnapshot {
  unit: PolderUnit;
  nowcast: NowcastCell[]; // one per lead time
  status: PolderStatus;
}

/** Everything the overview needs at one moment of time. */
export interface OpsSnapshot {
  at: IsoUtc;
  stations: StationReading[];
  polders: PolderSnapshot[];
  /** Recommendations issued at or before `at` whose window has not ended. */
  openRecommendations: Recommendation[];
  health: ConnectorHealth[];
}
