'use client';

// Open recommendations on the overview: how many are waiting for the
// operator, and the three most likely ones.

import Link from 'next/link';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import type { PolderUnit, Recommendation } from '@/lib/ops/types';
import { useAcknowledgements } from '@/lib/ops/hooks';
import { formatWibTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/operator/ui/empty-state';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { ACTION_LABEL, OPERATOR_ACTION_META, RECIPIENT_LABEL, formatPct } from '@/components/operator/ops/meta';

export function RecommendationSummary({
  open,
  polders,
  className,
}: {
  /** Recommendations whose window has not ended (snapshot.openRecommendations). */
  open: Recommendation[];
  polders: PolderUnit[];
  className?: string;
}) {
  const { acks } = useAcknowledgements();
  const unanswered = open.filter((r) => !acks[r.id]);
  const top = [...open]
    .sort((a, b) => Number(!!acks[a.id]) - Number(!!acks[b.id]) || b.probability - a.probability)
    .slice(0, 3);
  const nameOf = (id: string) => polders.find((p) => p.id === id)?.name ?? id;
  const anySimulated = open.some((r) => r.provenance.kind === 'simulated');

  return (
    <section className={cn('flex flex-col', className)} aria-label="Rekomendasi terbuka">
      <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-op-fg">Rekomendasi terbuka</h2>
          <p className="mt-0.5 text-[10px] text-op-fg-3">Saran untuk operator; keputusan di tangan operator.</p>
        </div>
        {anySimulated && <SimulasiBadge />}
      </div>

      {open.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Tidak ada rekomendasi terbuka" description="Rekomendasi muncul saat peluang banjir atau kondisi pompa memenuhi aturan pemicu." />
      ) : (
        <>
          <div className="mx-2 mb-2 flex items-baseline gap-1.5 rounded-lg border border-op-accent/30 bg-op-accent/10 px-2.5 py-1.5">
            <span className="text-sm font-bold leading-none tabular-nums text-op-fg">{unanswered.length}</span>
            <span className="text-[11px] font-semibold text-op-fg">
              belum ditanggapi <span className="text-op-fg-3">dari {open.length} terbuka</span>
            </span>
          </div>
          <ul className="space-y-1.5 px-2">
            {top.map((r) => {
              const ack = acks[r.id];
              return (
                <li key={r.id}>
                  <Link
                    href={`/operator/rekomendasi?id=${encodeURIComponent(r.id)}`}
                    className="block rounded-lg border border-white/5 bg-op-surface-2 px-3 py-2 transition-colors hover:bg-op-surface-3"
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-xs font-semibold leading-tight text-op-fg">{r.title}</p>
                      <span className="text-sm font-bold leading-none tabular-nums text-op-fg">{formatPct(r.probability)}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-op-fg-2">
                      {nameOf(r.polderId)} · {ACTION_LABEL[r.actionType]} · untuk {RECIPIENT_LABEL[r.recipient]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums text-op-fg-3">
                      <span>
                        Jendela {formatWibTime(r.windowStart).replace(' WIB', '')}–{formatWibTime(r.windowEnd)}
                      </span>
                      {ack && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', OPERATOR_ACTION_META[ack.action].chip)}>
                          {OPERATOR_ACTION_META[ack.action].label}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="px-3 pb-3 pt-2">
        <Link href="/operator/rekomendasi" className="inline-flex items-center gap-1.5 text-xs text-blue-400 transition-colors hover:text-blue-300">
          Buka semua rekomendasi <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
