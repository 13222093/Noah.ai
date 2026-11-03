// lib/ops/demo/data.ts
//
// Shape of lib/ops/demo/scenario-2020-01-01.json (built by
// scripts/build-demo-scenario.mjs) and a typed loader. Water levels and DSDA
// Siaga status are REAL archive data (S2); rain is REAL reanalysis (ERA5).
// Nothing in this file is simulated.

import type { IsoUtc, LevelPoint, PolderUnit, RainPoint, Station } from '../types';
import scenarioJson from './scenario-2020-01-01.json';

export interface ScenarioStation extends Station {
  qc: {
    stuck: boolean;
    spikeTs: IsoUtc[];
    negativeTs: IsoUtc[];
    duplicates: number;
    notes: string[];
  };
  /** Real readings in the window, ascending, flagged (never dropped). */
  series: LevelPoint[];
}

export interface ScenarioPolder extends PolderUnit {
  fullName: string;
  admin: string;
  refPointLabel: string;
  linkedPosts: { stationId: string; km: number; river: string }[];
  pumpNote: string;
  evidence: { c3: string | null; c6: string | null; c7: string | null };
  /** Every linked water-level post is stuck: the nowcast runs on rain only. */
  blindSpot: boolean;
}

export interface ScenarioRain {
  gridLat: number;
  gridLon: number;
  missingHours: number;
  /** Hourly, ts = start of the hour, ascending. */
  series: RainPoint[];
}

export interface ScenarioData {
  id: string;
  version: number;
  window: { startWib: string; endWib: string; start: IsoUtc; end: IsoUtc };
  stepMin: number;
  sources: {
    levels: { kind: 'historical'; source: string; file: string; note: string };
    rain: {
      kind: 'reanalysis';
      source: string;
      model: string;
      licence: string;
      note: string;
      url: string;
      fetchedAt: IsoUtc;
      raw: string;
    };
    thresholds: string;
    polders: string;
  };
  stations: ScenarioStation[];
  polders: ScenarioPolder[];
  rain: Record<string, ScenarioRain>;
}

export const SCENARIO_DATA = scenarioJson as unknown as ScenarioData;
