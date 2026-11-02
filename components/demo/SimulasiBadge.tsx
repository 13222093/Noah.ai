'use client';

import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDemoMode } from '@/lib/demo';

/**
 * Per-value label for synthetic or demo data (guardrail 5).
 * Put it next to every number, chart or layer that is not real.
 * It always renders when used; it does not depend on the flag, so a
 * synthetic value can never appear unlabelled.
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
        'inline-flex items-center gap-1 rounded border border-amber-500/60 bg-amber-500/15 px-1.5 py-0.5',
        'text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300',
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Global banner shown on every page while NOAH_DEMO_MODE is on.
 * Renders nothing when demo mode is off. The root layout computes `active`
 * on the server (where NOAH_DEMO_MODE is readable) so server and client agree.
 */
export function SimulasiBanner({ active = isDemoMode() }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[2000] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1 text-center text-xs font-semibold text-black"
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      MODE SIMULASI AKTIF: sebagian data di layar ini adalah data simulasi dan bukan pengamatan nyata.
    </div>
  );
}
