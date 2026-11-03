// lib/ops/provider.ts
//
// The provider behind lib/ops/hooks.ts.
//
// On this branch the operator section (/operator/**) is an explicitly
// labelled historical scenario, so getOpsProvider() always returns the
// 1 January 2020 replay (lib/ops/demo/, docs/demo/simulation.md), whatever
// NOAH_DEMO_MODE says. Every operator screen shows the SIMULASI banner and the
// "Skenario historis + simulasi" chip. The empty live stub stays exported for
// the v1 API provider; the interface stays.

import { createDemoProvider } from './demo/provider';
import type {
  Acknowledgement,
  IsoUtc,
  LevelPoint,
  NowcastCell,
  OpsSnapshot,
  PolderStatus,
  PolderUnit,
  RainPoint,
  Recommendation,
  ScenarioInfo,
  Station,
} from './types';

export interface OpsProvider {
  mode: 'demo' | 'live';
  scenario: ScenarioInfo | null;
  stations(): Station[];
  polders(): PolderUnit[];
  snapshotAt(at: IsoUtc): OpsSnapshot;
  levelSeries(stationId: string, from: IsoUtc, to: IsoUtc): LevelPoint[];
  rainSeries(polderId: string, from: IsoUtc, to: IsoUtc): RainPoint[];
  nowcastHistory(polderId: string, from: IsoUtc, to: IsoUtc): NowcastCell[];
  statusHistory(polderId: string, from: IsoUtc, to: IsoUtc): PolderStatus[];
  recommendationsUntil(at: IsoUtc): Recommendation[];
  /** React hook (called from useAcknowledgements). */
  useAcknowledgements(): {
    acks: Record<string, Acknowledgement>;
    acknowledge: (ack: Acknowledgement) => void;
    reset: () => void;
  };
}

const NOOP_ACKS = { acks: {}, acknowledge: () => {}, reset: () => {} };

/** Live stub: no data until the v1 API provider exists. Not used by /operator. */
export const emptyProvider: OpsProvider = {
  mode: 'live',
  scenario: null,
  stations: () => [],
  polders: () => [],
  snapshotAt: (at) => ({ at, stations: [], polders: [], openRecommendations: [], health: [] }),
  levelSeries: () => [],
  rainSeries: () => [],
  nowcastHistory: () => [],
  statusHistory: () => [],
  recommendationsUntil: () => [],
  useAcknowledgements: () => NOOP_ACKS,
};

let demoProvider: OpsProvider | null = null;

export function getOpsProvider(): OpsProvider {
  // Always the labelled historical replay (see the header). Built once, lazily: the replay precomputes every step on first use.
  if (!demoProvider) demoProvider = createDemoProvider();
  return demoProvider;
}
