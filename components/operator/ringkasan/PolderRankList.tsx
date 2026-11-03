'use client';

// Polders ranked by flood probability at the selected lead time.

import { useId } from 'react';
import Link from 'next/link';
import { ChevronRight, Waves } from 'lucide-react';
import type { LeadMin, PolderSnapshot } from '@/lib/ops/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/operator/ui/empty-state';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { RiskChip } from '@/components/operator/ops/Chips';
import { ProbabilityBars } from '@/components/operator/ops/ProbabilityBars';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { cellFor, formatPct, NO_DATA_COLOR, RISK_META } from '@/components/operator/ops/meta';

export function rankPolders(polders: PolderSnapshot[], lead: LeadMin): PolderSnapshot[] {
  return [...polders].sort((a, b) => {
    const pa = cellFor(a, lead)?.probability ?? -1;
    const pb = cellFor(b, lead)?.probability ?? -1;
    return pb - pa || a.unit.name.localeCompare(b.unit.name, 'id');
  });
}

export function PolderRankList({
  polders,
  lead,
  className,
  showHeader = true,
}: {
  polders: PolderSnapshot[];
  lead: LeadMin;
  className?: string;
  showHeader?: boolean;
}) {
  const titleId = useId();
  const ranked = rankPolders(polders, lead);
  const stamp = ranked.map((p) => cellFor(p, lead)?.provenance).find(Boolean);
  const anySimulated = ranked.some((p) => p.nowcast.some((c) => c.provenance.kind === 'simulated'));

  return (
    <section className={cn('flex flex-col', className)} aria-labelledby={showHeader ? titleId : undefined} aria-label={showHeader ? undefined : 'Peluang banjir per polder'}>
      {showHeader && (
        <div className="space-y-1 px-3 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="font-heading text-[11px] font-semibold uppercase tracking-[0.08em] text-op-fg-2">
              Peluang banjir per polder
            </h2>
            {anySimulated && <SimulasiBadge />}
          </div>
          <p className="text-[11px] text-op-fg-3">Diurutkan menurut peluang dalam {lead} menit ke depan.</p>
        </div>
      )}

      {ranked.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="Belum ada data polder"
          description="Peluang banjir per polder untuk 60, 120 dan 180 menit ke depan tampil di sini setelah sumber data tersedia."
        />
      ) : (
        <ol className="space-y-1 px-2 pb-2">
          {ranked.map((p, i) => {
            const cell = cellFor(p, lead);
            const color = cell ? RISK_META[cell.category].color : NO_DATA_COLOR;
            return (
              <li key={p.unit.id}>
                <Link
                  href={`/operator/polder/${p.unit.id}`}
                  className="group block rounded border border-l-[3px] border-op-border bg-op-surface-2 px-2.5 py-1.5 transition-colors hover:border-op-border-strong hover:bg-op-surface-3"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-op-fg-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-op-fg">{p.unit.name}</span>
                    <span className="font-mono text-base font-bold leading-none tabular-nums text-op-fg">
                      {cell ? formatPct(cell.probability) : '–'}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-op-fg-disabled group-hover:text-op-fg-2" aria-hidden />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-6">
                    <RiskChip category={cell?.category} />
                    <ProbabilityBars cells={p.nowcast} selected={lead} className="flex-1" />
                  </div>
                  {cell?.reasons[0] && (
                    <p className="mt-1 line-clamp-1 pl-6 text-[11px] text-op-fg-2" title={cell.reasons[0]}>
                      {cell.reasons[0]}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {stamp && (
        <div className="border-t border-op-border px-3 py-2">
          <SourceStamp provenance={stamp} timeLabel="diterbitkan" />
        </div>
      )}
    </section>
  );
}
