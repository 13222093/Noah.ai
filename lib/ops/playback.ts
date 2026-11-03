// lib/ops/playback.ts
//
// Replay clock shared by every operator page: the moment the screens show,
// play/pause and speed. In live mode the clock simply follows the wall clock.

import { create } from 'zustand';
import type { IsoUtc } from './types';

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

interface PlaybackState {
  /** Current replay time (UTC ms). null until the provider sets the range. */
  nowMs: number | null;
  startMs: number | null;
  endMs: number | null;
  stepMin: number;
  playing: boolean;
  /** Replay steps advanced per real second. */
  speed: PlaybackSpeed;
  init: (range: { start: IsoUtc; end: IsoUtc; stepMin: number; initial?: IsoUtc }) => void;
  seek: (ts: IsoUtc | number) => void;
  step: (direction: 1 | -1) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

function clamp(ms: number, start: number | null, end: number | null): number {
  if (start !== null && ms < start) return start;
  if (end !== null && ms > end) return end;
  return ms;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  nowMs: null,
  startMs: null,
  endMs: null,
  stepMin: 10,
  playing: false,
  speed: 1,
  init: ({ start, end, stepMin, initial }) => {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    const current = get().nowMs;
    const fresh = get().startMs !== startMs || get().endMs !== endMs;
    set({
      startMs,
      endMs,
      stepMin,
      nowMs: fresh || current === null ? clamp(initial ? Date.parse(initial) : startMs, startMs, endMs) : current,
    });
  },
  seek: (ts) => {
    const { startMs, endMs } = get();
    const ms = typeof ts === 'number' ? ts : Date.parse(ts);
    set({ nowMs: clamp(ms, startMs, endMs) });
  },
  step: (direction) => {
    const { nowMs, stepMin, startMs, endMs } = get();
    if (nowMs === null) return;
    const next = clamp(nowMs + direction * stepMin * 60_000, startMs, endMs);
    set({ nowMs: next, playing: next === endMs ? false : get().playing });
  },
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}));

/** Current replay time as ISO UTC, or null before init. */
export function usePlaybackNow(): IsoUtc | null {
  const nowMs = usePlaybackStore((s) => s.nowMs);
  return nowMs === null ? null : new Date(nowMs).toISOString();
}
