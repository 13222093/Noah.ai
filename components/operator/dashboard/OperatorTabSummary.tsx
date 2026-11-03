'use client';

// "Operator" tab in the dashboard's bottom strip: a static preview of the
// 1 January 2020 replay at the Manggarai peak, linking into /operator.
// The dashboard has no replay clock, so this reads one fixed moment.

import Link from 'next/link';
import { ArrowRight, ClipboardCheck, Waves } from 'lucide-react';
import { useOpsSnapshot, useScenario } from '@/lib/ops/hooks';
import { formatWibDateTime } from '@/lib/time';
import { RiskChip } from '@/components/operator/ops/Chips';
import { cellFor, formatPct } from '@/components/operator/ops/meta';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';

export function OperatorTabSummary() {
  const scenario = useScenario();
  const peak =
    scenario?.moments.find((m) => /Puncak Manggarai/i.test(m.label))?.ts ?? scenario?.end ?? undefined;
  const snapshot = useOpsSnapshot(peak);

  if (!scenario || !snapshot) {
    return <div className="p-4 text-xs text-op-fg-3">Skenario operator belum tersedia.</div>;
  }

  const ranked = [...snapshot.polders]
    .map((p) => ({ p, cell: cellFor(p, 120) }))
    .sort((a, b) => (b.cell?.probability ?? -1) - (a.cell?.probability ?? -1));
  const query = `?t=${encodeURIComponent(snapshot.at)}`;

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-3 py-2 text-op-fg">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Waves className="h-4 w-4 text-op-accent" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider">Mode Operator Polder</span>
        <SimulasiBadge />
        <span className="text-[11px] text-op-fg-3">
          {scenario.title} · pratinjau {formatWibDateTime(snapshot.at)} · peluang banjir 120 menit · saran, operator yang memutuskan
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/operator/rekomendasi${query}`}
            className="inline-flex items-center gap-1.5 rounded border border-op-border-strong px-2.5 py-1 text-[11px] text-op-fg-2 hover:text-op-fg"
          >
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> {snapshot.openRecommendations.length} rekomendasi terbuka
          </Link>
          <Link
            href={`/operator${query}`}
            className="inline-flex items-center gap-1.5 rounded border border-op-accent/60 bg-op-accent/10 px-2.5 py-1 text-[11px] font-semibold text-op-accent hover:bg-op-accent/20"
          >
            Buka Mode Operator <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ranked.map(({ p, cell }) => (
          <Link
            key={p.unit.id}
            href={`/operator/polder/${p.unit.id}${query}`}
            title={cell?.reasons[0]}
            className="flex flex-col gap-1 rounded border border-op-border bg-op-surface-1 px-2.5 py-1.5 hover:border-op-border-strong"
          >
            <span className="truncate text-[11px] font-semibold text-op-fg-2">{p.unit.name}</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-base tabular-nums">{formatPct(cell?.probability)}</span>
              <RiskChip category={cell?.category} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
