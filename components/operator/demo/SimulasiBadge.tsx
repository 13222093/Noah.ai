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
 * label never reads as a warning level. Drawn like the dashboard's KRITIKAL /
 * BAHAYA badges: small tinted pill, bold uppercase. Use one per panel header,
 * not one per row.
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
        'inline-flex shrink-0 items-center rounded bg-op-sim/15 px-1.5 py-0.5',
        'text-[9px] font-extrabold uppercase leading-none tracking-wider text-op-sim',
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Thin strip for demo mode outside the operator section: follows
 * NOAH_DEMO_MODE and renders nothing when demo mode is off. The /operator
 * section does not use it; its top bar carries the REPLAY chip and the
 * scenario disclosure instead (components/operator/ops/ScenarioBanner.tsx).
 */
export function SimulasiBanner({ active = isDemoMode(), className }: { active?: boolean; className?: string }) {
  if (!active) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex h-6 items-center justify-center gap-2 overflow-hidden whitespace-nowrap border-b border-op-border bg-op-sim/10 px-3 text-center text-[11px] text-op-fg-2',
        className,
      )}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-op-sim" aria-hidden />
      <span className="truncate">
        <span className="font-bold tracking-wider text-op-sim">MODE SIMULASI AKTIF</span>
        <span className="hidden sm:inline">: sebagian data di layar ini adalah data simulasi dan bukan pengamatan nyata.</span>
      </span>
    </div>
  );
}
