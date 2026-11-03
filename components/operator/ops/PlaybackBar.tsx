'use client';

// Replay controls docked at the bottom of every operator screen: the replay
// time in WIB (mono, as the dashboard clock but larger), play/pause, step,
// speed (dashboard segmented control), a scrubber with tick marks for the
// scenario's notable moments, and jump-to pills.
// Keyboard (handled by PlaybackController): space = play/pause, left/right = step.

import { useMemo } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { ChevronLeft, ChevronRight, Pause, Play, Flag, History } from 'lucide-react';
import { useScenario } from '@/lib/ops/hooks';
import { PLAYBACK_SPEEDS, usePlaybackStore } from '@/lib/ops/playback';
import type { ScenarioMoment } from '@/lib/ops/types';
import { cn } from '@/lib/utils';
import { formatWibDate, formatWibTime, getWibParts } from '@/lib/time';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/operator/ui/tooltip';
import { focusMoment } from '@/lib/operator/mapLayerStore';
import { togglePlayback } from './PlaybackController';

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function weekdayWib(ms: number): string {
  const p = getWibParts(ms);
  return WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
}

function hhmm(ms: number): string {
  return formatWibTime(ms).replace(' WIB', '');
}

interface HourTick {
  ms: number;
  pct: number;
  label: string | null;
  major: boolean;
  /** Every other labelled tick; hidden on phones. */
  odd: boolean;
}

function hourTicks(startMs: number, endMs: number): HourTick[] {
  const span = endMs - startMs;
  if (span <= 0) return [];
  const hours = span / 3_600_000;
  const every = hours <= 8 ? 1 : hours <= 16 ? 2 : hours <= 30 ? 3 : 6;
  const first = Math.ceil(startMs / 3_600_000) * 3_600_000;
  const out: HourTick[] = [];
  let majors = 0;
  for (let ms = first; ms <= endMs; ms += 3_600_000) {
    const h = getWibParts(ms).hour;
    const major = h % every === 0;
    const label = major ? (h === 0 ? formatWibDate(ms).replace(/ \d{4}$/, '') : hhmm(ms)) : null;
    out.push({ ms, pct: ((ms - startMs) / span) * 100, label, major, odd: major && majors++ % 2 === 1 });
  }
  return out;
}

function MomentMarker({
  moment,
  pct,
  passed,
  onJump,
}: {
  moment: ScenarioMoment;
  pct: number;
  passed: boolean;
  onJump: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onJump}
          aria-label={`Lompat ke ${hhmm(Date.parse(moment.ts))} WIB: ${moment.label}`}
          className="absolute top-0 flex h-4 w-4 -translate-x-1/2 items-start justify-center"
          style={{ left: `${pct}%` }}
        >
          <span
            className={cn(
              'block h-2 w-2 rotate-45 rounded-[1px] border',
              passed ? 'border-op-fg-2 bg-op-fg-2' : 'border-op-fg-2 bg-op-surface-1',
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[3000] max-w-xs text-xs">
        <span className="font-mono font-semibold tabular-nums text-op-fg">{hhmm(Date.parse(moment.ts))} WIB</span> · {moment.label}
      </TooltipContent>
    </Tooltip>
  );
}

export function PlaybackBar({ className }: { className?: string }) {
  const scenario = useScenario();
  const nowMs = usePlaybackStore((s) => s.nowMs);
  const startMs = usePlaybackStore((s) => s.startMs);
  const endMs = usePlaybackStore((s) => s.endMs);
  const stepMin = usePlaybackStore((s) => s.stepMin);
  const playing = usePlaybackStore((s) => s.playing);
  const speed = usePlaybackStore((s) => s.speed);
  const { seek, step, setPlaying, setSpeed } = usePlaybackStore.getState();

  const ticks = useMemo(
    () => (startMs !== null && endMs !== null ? hourTicks(startMs, endMs) : []),
    [startMs, endMs],
  );

  if (!scenario || nowMs === null || startMs === null || endMs === null) return null;

  const stepMs = stepMin * 60_000;
  const maxIndex = Math.max(1, Math.round((endMs - startMs) / stepMs));
  const index = Math.round((nowMs - startMs) / stepMs);
  const span = endMs - startMs || 1;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - startMs) / span) * 100));
  const moments = scenario.moments
    .map((m) => ({ m, ms: Date.parse(m.ts) }))
    .filter(({ ms }) => !Number.isNaN(ms))
    .sort((a, b) => a.ms - b.ms);
  const nextMoment = moments.find(({ ms }) => ms > nowMs);

  const jump = (ms: number, m?: ScenarioMoment) => {
    setPlaying(false);
    seek(ms);
    if (m) focusMoment(m);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-label="Kontrol pemutaran ulang"
        className={cn(
          'border-t border-white/5 bg-op-surface-1 text-op-fg',
          'px-3 pb-1.5 pt-1.5 md:px-4',
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 md:flex-nowrap md:gap-x-4">
          {/* Replay clock */}
          <div className="flex min-w-0 items-center gap-2">
            <time
              dateTime={new Date(nowMs).toISOString()}
              className="font-mono text-xl font-bold leading-none tabular-nums text-op-fg md:text-2xl"
            >
              {hhmm(nowMs)}
            </time>
            <div className="flex flex-col leading-tight">
              <span className="inline-flex w-fit items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wider text-op-fg-2">
                <History className="h-2.5 w-2.5" aria-hidden />
                WIB · <span className="hidden md:inline">waktu </span>replay
              </span>
              <span className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-op-fg-2">
                <span className="hidden md:inline">{weekdayWib(nowMs)}, </span>
                {formatWibDate(nowMs)}
              </span>
            </div>
          </div>

          {/* Transport */}
          <div className="ml-auto flex items-center gap-1 md:ml-0 md:gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                step(-1);
              }}
              disabled={nowMs <= startMs}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-op-fg-2 transition-colors hover:bg-white/5 hover:text-white disabled:text-op-fg-disabled disabled:hover:bg-transparent"
              aria-label={`Mundur ${stepMin} menit`}
              title={`Mundur ${stepMin} mnt (←)`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={togglePlayback}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                playing
                  ? 'border-transparent bg-op-accent-fill text-op-on-accent shadow-sm hover:bg-op-accent-fill/90'
                  : 'border-white/10 bg-white/5 text-op-fg hover:bg-white/10',
              )}
              aria-label={playing ? 'Jeda' : 'Putar'}
              aria-pressed={playing}
              title={playing ? 'Jeda (spasi)' : 'Putar (spasi)'}
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                step(1);
              }}
              disabled={nowMs >= endMs}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-op-fg-2 transition-colors hover:bg-white/5 hover:text-white disabled:text-op-fg-disabled disabled:hover:bg-transparent"
              aria-label={`Maju ${stepMin} menit`}
              title={`Maju ${stepMin} mnt (→)`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSpeed(PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(speed) + 1) % PLAYBACK_SPEEDS.length])}
              className="ml-0.5 flex h-8 min-w-[2.5rem] items-center justify-center rounded-lg bg-black/30 px-2 text-xs font-medium tabular-nums text-op-fg md:hidden"
              aria-label={`Kecepatan ${speed}×, ketuk untuk ganti`}
            >
              {speed}×
            </button>
          </div>

          {/* Speed: segmented control from md up (cycling button on phones, next to transport) */}
          <div className="hidden flex-col items-start gap-0.5 md:flex">
            <div role="radiogroup" aria-label="Kecepatan" className="inline-flex items-center gap-0.5 rounded-lg bg-black/30 p-0.5">
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={speed === s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    'flex h-6 items-center rounded-md px-2 text-xs font-medium tabular-nums transition-all duration-150',
                    speed === s ? 'bg-op-accent-fill text-op-on-accent shadow-sm' : 'text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
                  )}
                  title={`${s} langkah (${s * stepMin} menit replay) per detik`}
                >
                  {s}×
                </button>
              ))}
            </div>
            <span className="hidden text-[9px] tabular-nums text-op-fg-3 md:block">
              {speed * stepMin} mnt replay / detik
            </span>
          </div>

          {/* Scrubber */}
          <div className="w-full min-w-0 md:flex-1">
            <div className="relative h-4">
              {moments.map(({ m, ms }) => (
                <MomentMarker key={`${m.ts}-${m.label}`} moment={m} pct={pct(ms)} passed={ms <= nowMs} onJump={() => jump(ms, m)} />
              ))}
            </div>
            <SliderPrimitive.Root
              value={[index]}
              min={0}
              max={maxIndex}
              step={1}
              onValueChange={([v]) => {
                setPlaying(false);
                seek(startMs + v * stepMs);
              }}
              className="relative flex h-5 w-full touch-none select-none items-center"
              aria-label="Waktu replay"
            >
              <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/5">
                <SliderPrimitive.Range className="absolute h-full bg-op-accent-fill" />
              </SliderPrimitive.Track>
              {moments.map(({ m, ms }) => (
                <span
                  key={`line-${m.ts}-${m.label}`}
                  aria-hidden
                  className="pointer-events-none absolute top-0 h-5 w-px bg-op-fg-3/50"
                  style={{ left: `${pct(ms)}%` }}
                />
              ))}
              <SliderPrimitive.Thumb
                aria-valuetext={`${formatWibDate(nowMs)} ${formatWibTime(nowMs)}`}
                className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-op-accent-fill shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent focus-visible:ring-offset-1 focus-visible:ring-offset-op-surface-1"
              />
            </SliderPrimitive.Root>
            <div className="relative h-3.5 text-[9px] tabular-nums text-op-fg-3" aria-hidden>
              {ticks.map((t) => (
                <span
                  key={t.ms}
                  className={cn(
                    'absolute top-0',
                    t.pct < 4 ? 'translate-x-0' : t.pct > 96 ? '-translate-x-full' : '-translate-x-1/2',
                  )}
                  style={{ left: `${t.pct}%` }}
                >
                  <span className={cn('block w-px', t.pct < 4 ? '' : t.pct > 96 ? 'ml-auto' : 'mx-auto', t.major ? 'h-1 bg-op-fg-3' : 'h-0.5 bg-white/10')} />
                  {t.label && <span className={cn('block leading-none', t.odd && 'hidden sm:block')}>{t.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Jump-to moments */}
        {moments.length > 0 && (
          <div className="mt-1 flex items-center gap-1 overflow-x-auto pb-0.5 op-scrollbar-hide">
            <span className="mr-0.5 flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-op-fg-3">
              <Flag className="h-3 w-3" aria-hidden /> Lompat ke
            </span>
            {moments.map(({ m, ms }) => {
              const isNext = nextMoment?.ms === ms;
              const passed = ms <= nowMs;
              return (
                <button
                  key={`chip-${m.ts}-${m.label}`}
                  type="button"
                  onClick={() => jump(ms, m)}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
                    isNext
                      ? 'border-op-accent/30 bg-op-accent/20 text-op-fg'
                      : passed
                        ? 'border-transparent text-op-fg-3 hover:bg-white/5 hover:text-white'
                        : 'border-transparent text-op-fg-2 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <span className="font-mono font-semibold tabular-nums">{hhmm(ms)}</span>
                  <span className="max-w-[16rem] truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
