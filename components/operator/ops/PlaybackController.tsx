'use client';

// Drives the shared replay clock (lib/ops/playback.ts). Mounted once in the
// app chrome so the clock keeps running across page changes.
// - Scenario mode: init the range from the scenario (a `?t=<ISO>` deep link
//   sets the start moment), advance step(1) `speed` times per second while
//   playing, and handle the keyboard: space = play/pause, left/right = step.
// - Live mode (no scenario): the clock follows the wall clock, once a minute.

import { useEffect } from 'react';
import { useOpsMode, useScenario } from '@/lib/ops/hooks';
import { usePlaybackStore } from '@/lib/ops/playback';

/** Play/pause; pressing play at the end restarts from the beginning. */
export function togglePlayback() {
  const s = usePlaybackStore.getState();
  if (s.nowMs === null) return;
  if (!s.playing && s.endMs !== null && s.nowMs >= s.endMs && s.startMs !== null) {
    s.seek(s.startMs);
  }
  s.setPlaying(!s.playing);
}

const KEY_IGNORE =
  'input,textarea,select,[contenteditable="true"],[role="slider"],[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="combobox"],[role="radiogroup"],[role="tablist"],[cmdk-root],.leaflet-container';

function readDeepLinkTime(): string | undefined {
  try {
    const t = new URLSearchParams(window.location.search).get('t');
    if (!t) return undefined;
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
  } catch {
    return undefined;
  }
}

export function PlaybackController() {
  const scenario = useScenario();
  const mode = useOpsMode();
  const init = usePlaybackStore((s) => s.init);
  const playing = usePlaybackStore((s) => s.playing);
  const speed = usePlaybackStore((s) => s.speed);

  // Scenario range.
  useEffect(() => {
    if (!scenario) return;
    init({
      start: scenario.start,
      end: scenario.end,
      stepMin: scenario.stepMin,
      initial: readDeepLinkTime() ?? scenario.initialTs,
    });
  }, [scenario, init]);

  // Live mode: follow the wall clock.
  useEffect(() => {
    if (scenario || mode !== 'live') return;
    const follow = () => {
      const now = Date.now();
      init({
        start: new Date(now - 24 * 3_600_000).toISOString(),
        end: new Date(now).toISOString(),
        stepMin: 10,
        initial: new Date(now).toISOString(),
      });
    };
    follow();
    const id = window.setInterval(follow, 60_000);
    return () => window.clearInterval(id);
  }, [scenario, mode, init]);

  // Replay driver: `speed` steps per real second.
  useEffect(() => {
    if (!playing || !scenario) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (t: number) => {
      acc += ((t - last) * speed) / 1000;
      last = t;
      // Cap catch-up after a background tab so the clock does not jump far.
      if (acc > 2) acc = 1;
      while (acc >= 1) {
        acc -= 1;
        usePlaybackStore.getState().step(1);
      }
      if (usePlaybackStore.getState().playing) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, speed, scenario]);

  // Keyboard.
  useEffect(() => {
    if (!scenario) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(KEY_IGNORE)) return;
      if (e.key === ' ' || e.code === 'Space') {
        // A focused button or link handles space itself.
        if (target?.closest('button,a,[role="button"],summary')) return;
        e.preventDefault();
        togglePlayback();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const s = usePlaybackStore.getState();
        s.setPlaying(false);
        s.step(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scenario]);

  return null;
}
