'use client';

// Category chips, as the dashboard's tinted status badges (rounded, filled
// tint, bold). Colour is never the only signal: every chip carries its text
// label and a dot.

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
      <span className={cn('inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-op-fg-3', className)}>
        Belum ada
      </span>
    );
  }
  const meta = RISK_META[category];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded font-bold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2 py-0.5 text-[11px]',
        meta.chip,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function SiagaChip({ level, className }: { level: SiagaLevel; className?: string }) {
  const meta = SIAGA_META[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold leading-none',
        meta.chip,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-[1px]" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
