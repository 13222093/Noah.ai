'use client';

import { useState } from 'react';
import { List, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';

export interface MapLegendItem {
  color: string;
  label: string;
  description?: string;
}

/**
 * Prop-driven legend. Renders nothing when there are no items, so the map
 * never shows a legend for layers that do not exist yet.
 * The caller is responsible for the source and "data terakhir" line.
 */
export function MapLegend({
  title = 'Legenda',
  items,
  footer,
}: {
  title?: string;
  items: MapLegendItem[];
  footer?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-[1000]">
      {isOpen && (
        <Card className="mb-2 p-3 max-w-xs bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-slate-50">
          <h3 className="mb-2 text-sm font-semibold">{title}</h3>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-slate-400 dark:border-slate-600"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-slate-600 dark:text-slate-400">{item.description}</span>
                )}
              </li>
            ))}
          </ul>
          {footer && <div className="mt-2 border-t border-slate-300 pt-2 text-xs dark:border-slate-700">{footer}</div>}
        </Card>
      )}
      <Button
        onClick={() => setIsOpen((o) => !o)}
        variant="secondary"
        className="h-10 w-10 rounded-full shadow-lg"
        aria-label={isOpen ? 'Tutup legenda' : 'Buka legenda'}
      >
        {isOpen ? <X size={18} /> : <List size={18} />}
      </Button>
    </div>
  );
}
