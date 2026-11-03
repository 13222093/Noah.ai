'use client';

// Small UI helpers on top of the data contract (lib/ops/hooks.ts and the
// playback store). They read nothing else.

import { useMemo } from 'react';
import { useAcknowledgements, useOpsSnapshot, useRecommendations } from '@/lib/ops/hooks';
import { usePlaybackStore } from '@/lib/ops/playback';
import type { Acknowledgement, Recommendation } from '@/lib/ops/types';

export type RecStatus = 'terbuka' | 'ditanggapi' | 'lewat';

/** Status of a recommendation at replay time `nowMs`. */
export function recStatus(rec: Recommendation, ack: Acknowledgement | undefined, nowMs: number | null): RecStatus {
  if (ack) return 'ditanggapi';
  if (nowMs !== null && Date.parse(rec.windowEnd) <= nowMs) return 'lewat';
  return 'terbuka';
}

/** Replay window as ISO strings (null until the clock starts). */
export function useReplayWindow(): { startIso: string | null; endIso: string | null; nowMs: number | null } {
  const startMs = usePlaybackStore((s) => s.startMs);
  const endMs = usePlaybackStore((s) => s.endMs);
  const nowMs = usePlaybackStore((s) => s.nowMs);
  return useMemo(
    () => ({
      startIso: startMs === null ? null : new Date(startMs).toISOString(),
      endIso: endMs === null ? null : new Date(endMs).toISOString(),
      nowMs,
    }),
    [startMs, endMs, nowMs],
  );
}

/** Open recommendations (window not ended) the operator has not answered yet. */
export function useUnansweredOpen(): Recommendation[] {
  const snapshot = useOpsSnapshot();
  const { acks } = useAcknowledgements();
  return (snapshot?.openRecommendations ?? []).filter((r) => !acks[r.id]);
}

/** Every recommendation for one polder up to the replay time, newest first. */
export function usePolderRecommendations(polderId: string): Recommendation[] {
  return useRecommendations().filter((r) => r.polderId === polderId);
}
