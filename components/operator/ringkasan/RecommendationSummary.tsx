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
          <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-op-fg-2">Rekomendasi terbuka</h2>
          <p className="mt-0.5 text-[11px] text-op-fg-3">Saran untuk operator; keputusan di tangan operator.</p>
        </div>
        {anySimulated && <SimulasiBadge />}
      </div>

      {open.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Tidak ada rekomendasi terbuka" description="Rekomendasi muncul saat peluang banjir atau kondisi pompa memenuhi aturan pemicu." />
      ) : (
        <>
          <div className="mx-3 mb-2 flex items-baseline gap-2 rounded border border-op-border-strong bg-op-surface-2 px-2.5 py-1.5">
            <span className="font-mono text-xl font-bold leading-none tabular-nums text-op-fg">{unanswered.length}</span>
            <span className="text-xs text-op-fg">
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
                    className="block rounded border border-op-border bg-op-surface-2 px-2.5 py-1.5 hover:border-op-border-strong hover:bg-op-surface-3"
                  >
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-op-fg">{r.title}</p>
                      <span className="font-mono text-sm font-bold tabular-nums text-op-fg">{formatPct(r.probability)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-op-fg-2">
                      {nameOf(r.polderId)} · {ACTION_LABEL[r.actionType]} · untuk {RECIPIENT_LABEL[r.recipient]}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums text-op-fg-2">
                      <span>
                        Jendela {formatWibTime(r.windowStart).replace(' WIB', '')}–{formatWibTime(r.windowEnd)}
                      </span>
                      {ack && (
                        <span className={cn('rounded-sm border px-1.5 text-[10px] font-semibold', OPERATOR_ACTION_META[ack.action].chip)}>
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
        <Link href="/operator/rekomendasi" className="inline-flex items-center gap-1.5 text-xs font-medium text-op-accent hover:underline">
          Buka semua rekomendasi <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
