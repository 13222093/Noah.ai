'use client';

// Legend for the operator map: risk scale for polders, Siaga scale for posts,
// and the special marks (unchanging sensor, old data). Layer toggles included.

import { useState } from 'react';
import { ChevronDown, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMapLayerStore } from '@/lib/operator/mapLayerStore';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { RISK_META, RISK_ORDER, SIAGA_META, tokenColor } from '@/components/operator/ops/meta';
import { MAP_OVERLAY_CARD } from './MapControls';

const SIAGA_KEYS = ['normal', 'siaga3', 'siaga2', 'siaga1'] as const;

export function OpsLegend({ className, defaultOpen = true }: { className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { showPolders, showStations, toggleLayer } = useMapLayerStore();

  return (
    <div className={cn('pointer-events-auto absolute z-[1000]', className)}>
      {open ? (
        <div className={cn(MAP_OVERLAY_CARD, 'w-60 p-3 text-op-fg')}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-op-fg">Legenda</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-0.5 text-op-fg-2 transition-colors hover:bg-white/5 hover:text-op-fg"
              aria-label="Tutup legenda"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-op-fg">
              <input type="checkbox" checked={showPolders} onChange={() => toggleLayer('polders')} className="accent-op-accent-fill" />
              Polder: peluang banjir
            </span>
            <SimulasiBadge />
          </label>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 pl-5">
            {RISK_ORDER.map((c) => (
              <li key={c} className="flex items-center gap-1.5 text-[11px] text-op-fg-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border-[1.5px]"
                  style={{ borderColor: RISK_META[c].color, backgroundColor: tokenColor(RISK_META[c].token, 0.4) }}
                  aria-hidden
                />
                {RISK_META[c].label}
              </li>
            ))}
          </ul>
          <p className="mt-1 pl-5 text-[10px] leading-snug text-op-fg-3">Lingkaran = titik acuan polder, bukan batas wilayah.</p>

          <label className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-op-fg">
            <input type="checkbox" checked={showStations} onChange={() => toggleLayer('stations')} className="accent-op-accent-fill" />
            Pos duga air: status Siaga DSDA
          </label>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 pl-5">
            {SIAGA_KEYS.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-[11px] text-op-fg-2">
                <span
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm font-mono text-[8px] font-bold"
                  style={{ backgroundColor: SIAGA_META[k].color, color: SIAGA_META[k].onColor }}
                  aria-hidden
                >
                  {SIAGA_META[k].short}
                </span>
                {SIAGA_META[k].label}
              </li>
            ))}
            <li className="col-span-2 flex items-center gap-1.5 text-[11px] text-op-fg-2">
              <span className="ops-hatch h-3.5 w-3.5 shrink-0 rounded-sm" aria-hidden />
              Sensor tidak berubah (diragukan)
            </li>
            <li className="col-span-2 flex items-center gap-1.5 text-[11px] text-op-fg-2">
              <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-op-fg-disabled opacity-60" aria-hidden />
              Data lama / belum ada
            </li>
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(MAP_OVERLAY_CARD, 'flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-op-fg transition-colors hover:bg-slate-800/80')}
          aria-label="Buka legenda"
        >
          <List className="h-4 w-4" aria-hidden /> Legenda
        </button>
      )}
    </div>
  );
}
