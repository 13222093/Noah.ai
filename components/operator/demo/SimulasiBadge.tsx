'use client';

import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demo';

/**
 * Per-value label for synthetic or demo data (guardrail 5).
 * Put it next to every number, chart or layer that is not real.
 * It always renders when used; it does not depend on the flag, so a
 * synthetic value can never appear unlabelled.
 *
 * Provenance violet (`sim` token): a hue no risk or Siaga level uses, so the
 * label never reads as a warning level. Outlined, light tint, small caps.
 */
export function SimulasiBadge({
  label = 'SIMULASI',
  title = 'Data simulasi, bukan pengamatan nyata. Tidak dihitung dalam skor.',
  className,
}: {
  label?: 'SIMULASI' | 'DEMO';
  title?: string;
  className?: string;
}) {
  return (
    <span
      role="note"
      title={title}
      aria-label={`${label}: ${title}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-sm border border-op-sim bg-op-sim/10 px-1.5 py-px',
        'text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-op-sim',
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Thin violet strip: violet tint, violet rule, violet label. The operator
 * layout (app/operator/layout.tsx) always passes `active`, because the
 * /operator section is a labelled historical scenario; elsewhere it follows
 * NOAH_DEMO_MODE and renders nothing when demo mode is off.
 */
export function SimulasiBanner({ active = isDemoMode(), className }: { active?: boolean; className?: string }) {
  if (!active) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex h-6 items-center justify-center gap-2 overflow-hidden whitespace-nowrap border-b border-op-sim bg-op-sim/[0.15] px-3 text-center text-xs text-op-fg',
        className,
      )}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-op-sim" aria-hidden />
      <span className="truncate">
        <span className="font-bold tracking-[0.08em] text-op-sim">MODE SIMULASI AKTIF</span>
        <span className="hidden sm:inline">: sebagian data di layar ini adalah data simulasi dan bukan pengamatan nyata.</span>
      </span>
    </div>
  );
}
