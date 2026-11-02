'use client';

import { useState } from 'react';
import { Layers, Maximize2, Minimize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BASEMAPS, type BasemapId } from '@/lib/constants';

interface MapControlsProps {
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  showFullscreenButton?: boolean;
}

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
    <div className="absolute top-3 left-3 z-[1001] space-y-2">
      <Card className="p-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOpen((o) => !o)}
            className="h-9 w-9"
            aria-label="Pilih peta dasar"
            aria-expanded={open}
            title="Peta dasar"
          >
            <Layers size={16} />
          </Button>
          {showFullscreenButton && (
            <Button
              variant="outline"
              size="icon"
              onClick={onFullscreenToggle}
              className="h-9 w-9"
              aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
              title={isFullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          )}
        </div>
      </Card>

      {open && (
        <Card className="p-2 w-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <p className="px-1 pb-1 text-xs font-medium text-slate-900 dark:text-slate-100">Peta dasar</p>
          <div className="flex flex-col gap-1">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onBasemapChange(id)}
                className={cn(
                  'flex items-center justify-between rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100',
                  'hover:bg-slate-200/60 dark:hover:bg-white/10',
                  basemap === id && 'bg-slate-200/80 dark:bg-white/10 font-semibold',
                )}
              >
                {BASEMAPS[id].name}
                {basemap === id && <Check size={12} aria-hidden />}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
