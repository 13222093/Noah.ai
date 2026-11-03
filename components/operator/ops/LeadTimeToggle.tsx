'use client';

// 60 / 120 / 180 minute lead-time switch, shared by the map and the ranking.
// Styled as the dashboard's SegmentedControl (components/tiling/SegmentedControl.tsx).

import { cn } from '@/lib/utils';
import { LEAD_TIMES, type LeadMin } from '@/lib/ops/types';
import { useMapLayerStore } from '@/lib/operator/mapLayerStore';

export function LeadTimeToggle({
  className,
  label = 'Peluang banjir dalam',
  value,
  onChange,
}: {
  className?: string;
  label?: string | null;
  /** Controlled use; defaults to the shared map store. */
  value?: LeadMin;
  onChange?: (lead: LeadMin) => void;
}) {
  const storeLead = useMapLayerStore((s) => s.leadMin);
  const setStoreLead = useMapLayerStore((s) => s.setLeadMin);
  const lead = value ?? storeLead;
  const set = onChange ?? setStoreLead;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && <span className="text-[10px] text-op-fg-2">{label}</span>}
      <div role="radiogroup" aria-label="Waktu ke depan" className="inline-flex items-center gap-0.5 rounded-lg bg-black/30 p-0.5">
        {LEAD_TIMES.map((l) => {
          const active = l === lead;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set(l)}
              className={cn(
                'flex h-7 items-center rounded-md px-2.5 text-xs font-medium tabular-nums transition-all duration-150',
                active ? 'bg-op-accent-fill text-op-on-accent shadow-sm' : 'text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
              )}
            >
              {l} mnt
            </button>
          );
        })}
      </div>
    </div>
  );
}
