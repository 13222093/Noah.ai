'use client';

// Category chips. Colour is never the only signal: every chip carries its text label.

import { cn } from '@/lib/utils';
import type { RiskCategory, SiagaLevel } from '@/lib/ops/types';
import { RISK_META, SIAGA_META } from './meta';

export function RiskChip({
  category,
  className,
  size = 'sm',
}: {
  category: RiskCategory | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (!category) {
    return (
      <span className={cn('inline-flex items-center rounded border border-op-border-strong px-1.5 text-[11px] text-op-fg-3', className)}>
        Belum ada
      </span>
    );
  }
  const meta = RISK_META[category];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border font-semibold',
        size === 'sm' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-xs',
        meta.chip,
        className,
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function SiagaChip({ level, className }: { level: SiagaLevel; className?: string }) {
  const meta = SIAGA_META[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-px text-[11px] font-semibold',
        meta.chip,
        className,
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
