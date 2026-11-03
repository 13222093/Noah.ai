'use client';

// Persistent label for the historical replay. In the top bar it sits where the
// dashboard shows its LIVE chip: a violet REPLAY chip plus one quiet line
// ("sebagian data simulasi"). Both open the disclosure popover that lists what
// is real and what is simulated. Never goes away while a scenario is active.

import { Info } from 'lucide-react';
import { useScenario } from '@/lib/ops/hooks';
import { usePlaybackStore } from '@/lib/ops/playback';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/operator/ui/popover';
import { cn } from '@/lib/utils';
import { formatWibDate, formatWibDateTime } from '@/lib/time';

/** Tinted pill in the dashboard's badge style (as KRITIKAL / BAHAYA). */
export function ScenarioChip({ className }: { className?: string }) {
  return (
    <span
      role="note"
      aria-label="Skenario historis dengan bagian simulasi, bukan kejadian saat ini"
      className={cn(
        'inline-flex shrink-0 items-center rounded bg-op-sim/15 px-1.5 py-0.5',
        'text-[9px] font-extrabold uppercase tracking-wider text-op-sim',
        className,
      )}
    >
      <span className="hidden sm:inline">Skenario historis + simulasi</span>
      <span className="sm:hidden">Historis + simulasi</span>
    </span>
  );
}

/** "1 Januari 2020" from the scenario title, else the scenario start date. */
function eventDate(title: string, startIso: string): string {
  const m = title.match(/\d{1,2} [A-Za-z]+ \d{4}/);
  return m ? m[0] : formatWibDate(startIso);
}

export function ScenarioBanner({ className }: { className?: string }) {
  const scenario = useScenario();
  const playing = usePlaybackStore((s) => s.playing);
  if (!scenario) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex min-w-0 items-center gap-2 rounded-full px-1.5 py-0.5 text-left transition-colors hover:bg-white/5',
            className,
          )}
          aria-label={`Mode replay: ${scenario.title}. Sebagian data simulasi. Apa yang nyata dan apa yang simulasi`}
          title="Mode simulasi aktif: sebagian data di layar ini adalah data simulasi dan bukan pengamatan nyata."
        >
          {/* Same shape as the dashboard's LIVE chip, in the SIMULASI colour */}
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[9px] font-medium text-op-sim">
            <span className={cn('h-1.5 w-1.5 rounded-full bg-op-sim', playing && 'animate-pulse')} aria-hidden />
            REPLAY
            <span className="hidden sm:inline">{eventDate(scenario.title, scenario.start)}</span>
          </span>
          <span className="hidden min-w-0 items-center gap-1 truncate text-[10px] text-op-fg-3 group-hover:text-op-fg-2 lg:flex">
            sebagian data simulasi
            <Info className="h-3 w-3 shrink-0" aria-hidden />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,440px)] border-op-border-strong bg-op-surface-2 p-0 text-op-fg"
      >
        <div className="border-b border-op-border px-3 py-2.5">
          <ScenarioChip />
          <p className="mt-2 text-[13px] font-semibold">{scenario.title}</p>
          <p className="mt-1 text-xs text-op-fg-2">{scenario.description}</p>
          <p className="mt-1 text-[11px] tabular-nums text-op-fg-3">
            {formatWibDateTime(scenario.start)} sampai {formatWibDateTime(scenario.end)}
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Apa yang nyata, apa yang simulasi</p>
          <ul className="mt-2 space-y-1.5">
            {scenario.disclosure.map((line) => (
              <li key={line} className="flex gap-2 text-xs leading-snug text-op-fg">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-op-fg-3" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-md border border-op-border bg-op-surface-1 px-2 py-1.5 text-[11px] text-op-fg-2">
            Ini pemutaran ulang kejadian lampau, bukan kondisi saat ini. Rekomendasi adalah saran; keputusan
            tetap di tangan operator.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
