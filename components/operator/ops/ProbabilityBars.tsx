'use client';

// Three small bars: flood probability at 60, 120 and 180 minutes.

import { cn } from '@/lib/utils';
import { LEAD_TIMES, type LeadMin, type NowcastCell } from '@/lib/ops/types';
import { NO_DATA_COLOR, RISK_META, formatPct } from './meta';

export function ProbabilityBars({
  cells,
  selected,
  className,
}: {
  cells: NowcastCell[];
  selected?: LeadMin;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-1.5', className)}>
      {LEAD_TIMES.map((lead) => {
        const cell = cells.find((c) => c.leadMin === lead);
        const pct = cell ? Math.max(0, Math.min(1, cell.probability)) * 100 : 0;
        const color = cell ? RISK_META[cell.category].color : NO_DATA_COLOR;
        const active = selected === lead;
        return (
          <div
            key={lead}
            className="min-w-0"
            title={cell ? `${lead} mnt: ${formatPct(cell.probability)} (${RISK_META[cell.category].label})` : `${lead} mnt: belum ada`}
          >
            <div className="flex items-baseline justify-between gap-1 text-[10px] leading-none">
              <span className={cn('tabular-nums', active ? 'font-semibold text-op-fg' : 'text-op-fg-3')}>{lead}′</span>
              <span className={cn('font-mono tabular-nums', active ? 'text-op-fg' : 'text-op-fg-2')}>
                {cell ? formatPct(cell.probability) : '–'}
              </span>
            </div>
            <div className={cn('mt-1 h-1.5 overflow-hidden rounded-sm bg-op-surface-3', active && 'ring-1 ring-op-accent')}>
              <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
