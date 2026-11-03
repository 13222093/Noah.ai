'use client';

// Freshness of each data source at the replay time (guardrail 12: stale over
// 15 minutes is flagged by the provider).

import { Gauge } from 'lucide-react';
import type { ConnectorHealth } from '@/lib/ops/types';
import { cn } from '@/lib/utils';
import { formatWibTime } from '@/lib/time';
import { EmptyState } from '@/components/operator/ui/empty-state';
import type { ProvenanceKind } from '@/lib/ops/types';
import { PROVENANCE_CHIP, PROVENANCE_ICON, PROVENANCE_LABEL } from '@/components/operator/ops/meta';

function ProvIcon({ kind }: { kind: ProvenanceKind }) {
  const Icon = PROVENANCE_ICON[kind];
  return <Icon className="h-2.5 w-2.5" aria-hidden />;
}

function ageText(ageMin: number | null): string {
  if (ageMin === null) return 'belum ada data';
  if (ageMin < 1) return 'baru saja';
  if (ageMin < 60) return `${ageMin} mnt lalu`;
  const h = Math.floor(ageMin / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.floor(h / 24)} hari lalu`;
}

export function ConnectorHealthStrip({
  health,
  className,
  layout = 'list',
}: {
  health: ConnectorHealth[];
  className?: string;
  layout?: 'list' | 'strip';
}) {
  return (
    <section className={cn('flex flex-col', className)} aria-label="Kesehatan sumber data">
      <div className="px-3 pb-1.5 pt-3">
        <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-op-fg-2">Sumber data</h2>
        <p className="mt-0.5 text-[11px] text-op-fg-3">Waktu data terakhir menurut jam replay.</p>
      </div>
      {health.length === 0 ? (
        <EmptyState icon={Gauge} title="Belum ada status sumber data" className="py-3" />
      ) : (
        <ul className={cn('px-2 pb-3', layout === 'strip' ? 'flex flex-wrap gap-1.5' : 'space-y-1')}>
          {health.map((h) => (
            <li
              key={h.id}
              className={cn(
                'flex items-center gap-2 rounded border px-2 py-1.5',
                h.stale ? 'border-op-border bg-transparent text-op-fg-disabled' : 'border-op-border bg-op-surface-2',
              )}
              title={`${h.provenance.source}${h.newestTs ? ` · data terakhir ${formatWibTime(h.newestTs)}` : ''}`}
            >
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', h.stale ? 'border border-op-fg-disabled bg-transparent' : 'bg-op-fg-2')}
                aria-hidden
              />
              <span className={cn('min-w-0 flex-1 truncate text-xs', h.stale ? 'text-op-fg-disabled' : 'text-op-fg')}>{h.label}</span>
              <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-sm border px-1 text-[9px] font-semibold uppercase tracking-[0.06em]', PROVENANCE_CHIP[h.provenance.kind])}>
                <ProvIcon kind={h.provenance.kind} />
                {PROVENANCE_LABEL[h.provenance.kind]}
              </span>
              <span className={cn('shrink-0 text-right text-[11px] tabular-nums', h.stale ? 'text-op-fg-disabled' : 'text-op-fg-2')}>
                {h.newestTs ? formatWibTime(h.newestTs) : '–'}
                <span className={cn('block text-[10px]', h.stale ? 'font-semibold text-op-fg-3' : 'text-op-fg-3')}>
                  {h.stale ? `lama · ${ageText(h.ageMin)}` : ageText(h.ageMin)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
