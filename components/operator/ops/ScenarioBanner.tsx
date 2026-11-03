'use client';

// Persistent label for the historical replay: a violet (SIMULASI) chip that never goes
// away while a scenario is active, the scenario title, and the list of what is
// real and what is simulated in a popover.

import { FlaskConical, History, Info } from 'lucide-react';
import { useScenario } from '@/lib/ops/hooks';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/operator/ui/popover';
import { cn } from '@/lib/utils';
import { formatWibDateTime } from '@/lib/time';

export function ScenarioChip({ className }: { className?: string }) {
  return (
    <span
      role="note"
      aria-label="Skenario historis dengan bagian simulasi, bukan kejadian saat ini"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-op-sim bg-op-sim/10 px-2 py-0.5',
        'text-[10px] font-bold uppercase tracking-[0.08em] text-op-sim',
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      <span className="hidden sm:inline">Skenario historis + simulasi</span>
      <span className="sm:hidden">Historis + simulasi</span>
    </span>
  );
}

export function ScenarioBanner({ className }: { className?: string }) {
  const scenario = useScenario();
  if (!scenario) return null;

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <ScenarioChip />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs text-op-fg hover:bg-op-surface-3"
            aria-label={`Tentang skenario: ${scenario.title}. Apa yang nyata dan apa yang simulasi`}
          >
            <History className="hidden h-3.5 w-3.5 shrink-0 text-op-fg-3 md:block" aria-hidden />
            <span className="hidden min-w-0 truncate font-medium md:inline">{scenario.title}</span>
            <Info className="h-3.5 w-3.5 shrink-0 text-op-fg-3 group-hover:text-op-fg" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(92vw,440px)] border-op-border-strong bg-op-surface-2 p-0 text-op-fg"
        >
          <div className="border-b border-op-border px-4 py-3">
            <ScenarioChip />
            <p className="mt-2 font-heading text-sm font-semibold">{scenario.title}</p>
            <p className="mt-1 text-xs text-op-fg-2">{scenario.description}</p>
            <p className="mt-1 text-[11px] tabular-nums text-op-fg-3">
              {formatWibDateTime(scenario.start)} sampai {formatWibDateTime(scenario.end)}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-op-fg-3">Apa yang nyata, apa yang simulasi</p>
            <ul className="mt-2 space-y-1.5">
              {scenario.disclosure.map((line) => (
                <li key={line} className="flex gap-2 text-xs leading-snug text-op-fg">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-op-fg-3" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-sm border border-op-border bg-op-surface-1 px-2 py-1.5 text-[11px] text-op-fg-2">
              Ini pemutaran ulang kejadian lampau, bukan kondisi saat ini. Rekomendasi adalah saran; keputusan
              tetap di tangan operator.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
