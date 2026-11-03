'use client';

import { useState } from 'react';
import { Layers, Maximize2, Minimize2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BASEMAPS, type BasemapId } from '@/lib/operator/basemaps';

interface MapControlsProps {
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  showFullscreenButton?: boolean;
}

/**
 * Map overlay card, as the dashboard's map controls (components/map/MapControls.tsx):
 * 16px radius, slate-900/80 with blur, gray-800/60 hairline.
 */
export const MAP_OVERLAY_CARD = 'rounded-2xl border border-gray-800/60 bg-slate-900/80 shadow-sm backdrop-blur-md';

/** 40px dark square button with a slate-600 ring, as the dashboard's gear / expand buttons. */
const MAP_BUTTON =
  'inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-600 bg-gray-950 text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-op-accent';

/** Basemap switcher and fullscreen toggle. Data layers get their own controls in W2. */
export function MapControls({
  basemap,
  onBasemapChange,
  isFullscreen,
  onFullscreenToggle,
  showFullscreenButton = true,
}: MapControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute left-4 top-4 z-[1001] space-y-2">
      <div className={cn(MAP_OVERLAY_CARD, 'p-2')}>
        <div className="flex flex-col space-y-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={MAP_BUTTON}
            aria-label="Pilih peta dasar"
            aria-expanded={open}
            title="Peta dasar"
          >
            <Layers size={16} />
          </button>
          {showFullscreenButton && (
            <button
              type="button"
              onClick={onFullscreenToggle}
              className={MAP_BUTTON}
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
              title={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className={cn(MAP_OVERLAY_CARD, 'w-44 p-2')}>
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-op-fg-2">Peta dasar</p>
          <div className="flex flex-col gap-1">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onBasemapChange(id)}
                className={cn(
                  'flex h-8 items-center justify-between rounded-md px-2 text-xs text-op-fg transition-colors',
                  'hover:bg-white/5',
                  basemap === id && 'bg-op-accent-fill/40 font-medium text-white',
                )}
              >
                {BASEMAPS[id]?.name}
                {basemap === id && <Check size={12} className="text-op-accent" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
