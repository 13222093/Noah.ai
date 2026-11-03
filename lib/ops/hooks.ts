// lib/ops/hooks.ts
//
// The only way operator pages read data. Signatures are the contract; the
// bodies delegate to the active provider (lib/ops/provider.ts). Pages must not
// import from lib/ops/demo/ directly.

import { getOpsProvider } from './provider';
import { usePlaybackNow } from './playback';
import type {
  Acknowledgement,
  IsoUtc,
  LevelPoint,
  OpsSnapshot,
  PolderUnit,
  RainPoint,
  Recommendation,
  ScenarioInfo,
  Station,
  NowcastCell,
  PolderStatus,
} from './types';

/** 'demo' while the historical replay is the source; 'live' later. */
export function useOpsMode(): 'demo' | 'live' {
  return getOpsProvider().mode;
}

/** Replay metadata, or null in live mode. */
export function useScenario(): ScenarioInfo | null {
  return getOpsProvider().scenario;
}

export function useStations(): Station[] {
  return getOpsProvider().stations();
}

export function usePolders(): PolderUnit[] {
  return getOpsProvider().polders();
}

/** Snapshot at the playback time (or `at` if given). Null before the clock starts. */
export function useOpsSnapshot(at?: IsoUtc): OpsSnapshot | null {
  const now = usePlaybackNow();
  const t = at ?? now;
  return t ? getOpsProvider().snapshotAt(t) : null;
}

/** Water level series for a post. `to` defaults to the playback time (no peeking ahead). */
export function useLevelSeries(stationId: string, from: IsoUtc, to?: IsoUtc): LevelPoint[] {
  const now = usePlaybackNow();
  const end = to ?? now;
  return end ? getOpsProvider().levelSeries(stationId, from, end) : [];
}

/** Hourly rain over a polder. `to` defaults to the playback time. */
export function useRainSeries(polderId: string, from: IsoUtc, to?: IsoUtc): RainPoint[] {
  const now = usePlaybackNow();
  const end = to ?? now;
  return end ? getOpsProvider().rainSeries(polderId, from, end) : [];
}

/** Nowcast history for a polder (issue times from..to), for charts. */
export function useNowcastHistory(polderId: string, from: IsoUtc, to?: IsoUtc): NowcastCell[] {
  const now = usePlaybackNow();
  const end = to ?? now;
  return end ? getOpsProvider().nowcastHistory(polderId, from, end) : [];
}

/** Sump/pump status history for a polder, for charts. */
export function usePolderStatusHistory(polderId: string, from: IsoUtc, to?: IsoUtc): PolderStatus[] {
  const now = usePlaybackNow();
  const end = to ?? now;
  return end ? getOpsProvider().statusHistory(polderId, from, end) : [];
}

/** Every recommendation issued up to the playback time, newest first. */
export function useRecommendations(): Recommendation[] {
  const now = usePlaybackNow();
  return now ? getOpsProvider().recommendationsUntil(now) : [];
}

/** Operator acknowledgements (demo: kept in the browser only). */
export function useAcknowledgements(): {
  acks: Record<string, Acknowledgement>;
  acknowledge: (ack: Acknowledgement) => void;
  reset: () => void;
} {
  return getOpsProvider().useAcknowledgements();
}
