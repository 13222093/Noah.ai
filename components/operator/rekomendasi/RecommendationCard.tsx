'use client';

// One recommendation: action, polder, probability, window (WIB), reason,
// provenance, and the operator's answer once given. Always framed as advice.

import Link from 'next/link';
import { MessageSquareText, Pencil, UserCheck } from 'lucide-react';
import type { Acknowledgement, Recommendation } from '@/lib/ops/types';
import type { RecStatus } from '@/hooks/useOps';
import { cn } from '@/lib/utils';
import { formatWibTime } from '@/lib/time';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { ACTION_LABEL, OPERATOR_ACTION_META, RECIPIENT_LABEL, formatPct } from '@/components/operator/ops/meta';

// Neutral status chips, distinguished by weight and fill (risk colours stay on
// the risk scale): open = strong outline, answered = filled, past = muted.
const STATUS_META: Record<RecStatus, { label: string; cls: string }> = {
  terbuka: { label: 'Terbuka', cls: 'border-op-fg-2 bg-transparent text-op-fg' },
  ditanggapi: { label: 'Ditanggapi', cls: 'border-op-border-strong bg-op-surface-3 text-op-fg-2' },
  lewat: { label: 'Lewat waktu', cls: 'border-op-border bg-transparent text-op-fg-3' },
};

function windowText(rec: Recommendation): string {
  return `${formatWibTime(rec.windowStart).replace(' WIB', '')}–${formatWibTime(rec.windowEnd)}`;
}

export function AckLine({ ack }: { ack: Acknowledgement }) {
  const meta = OPERATOR_ACTION_META[ack.action];
  return (
    <div className="flex items-start gap-2 rounded border border-op-border bg-op-surface-2 px-2.5 py-1.5 text-xs">
      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-op-fg-3" aria-hidden />
      <div className="min-w-0">
        <p className="tabular-nums text-op-fg-2">
          <span className={cn('mr-1.5 rounded-sm border px-1.5 py-px text-[11px] font-semibold', meta.chip)}>{meta.label}</span>
          {ack.by} · {formatWibTime(ack.at)}
        </p>
        {ack.note && <p className="mt-0.5 text-op-fg-2">“{ack.note}”</p>}
      </div>
    </div>
  );
}

export function RecommendationCard({
  rec,
  polderName,
  ack,
  status,
  selected = false,
  onSelect,
  onAck,
  compact = false,
}: {
  rec: Recommendation;
  polderName: string;
  ack?: Acknowledgement;
  status: RecStatus;
  selected?: boolean;
  onSelect?: () => void;
  onAck?: () => void;
  compact?: boolean;
}) {
  const st = STATUS_META[status];
  return (
    <article
      aria-label={`${rec.title}, ${polderName}`}
      className={cn(
        'rounded-lg border bg-op-surface-1 transition-colors',
        selected ? 'border-op-accent ring-1 ring-op-accent' : 'border-op-border',
        status === 'lewat' && !selected && 'opacity-75',
      )}
    >
      <div className={cn('space-y-2', compact ? 'p-2.5' : 'p-3')}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-sm border px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em]', st.cls)}>{st.label}</span>
              <span className="text-[11px] text-op-fg-2">untuk {RECIPIENT_LABEL[rec.recipient]}</span>
              {rec.provenance.kind === 'simulated' && <SimulasiBadge />}
            </div>
            <h3 className={cn('mt-1 font-heading font-semibold leading-snug text-op-fg', compact ? 'text-sm' : 'text-[15px]')}>{rec.title}</h3>
            <p className="text-xs text-op-fg-2">
              <Link href={`/operator/polder/${rec.polderId}`} className="text-op-accent underline-offset-2 hover:underline">
                {polderName}
              </Link>{' '}
              · {ACTION_LABEL[rec.actionType]}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn('font-mono font-bold leading-none tabular-nums text-op-fg', compact ? 'text-lg' : 'text-2xl')}>
              {formatPct(rec.probability)}
            </p>
            <p className="mt-1 text-[10px] tabular-nums text-op-fg-2">peluang dalam {rec.leadMin} mnt</p>
          </div>
        </div>

        <p className="text-xs tabular-nums text-op-fg">
          <span className="text-op-fg-3">Jendela waktu </span>
          {windowText(rec)}
        </p>
        {!compact && <p className="text-[13px] leading-snug text-op-fg-2">{rec.reason}</p>}

        {ack && <AckLine ack={ack} />}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <SourceStamp provenance={rec.provenance} timeLabel="terbit" stale={false} />
          <p className="text-[11px] italic text-op-fg-3">Saran — keputusan di tangan operator</p>
        </div>

        {(onAck || onSelect) && (
          <div className="flex flex-wrap gap-2 border-t border-op-border pt-2">
            {onAck && (
              <button
                type="button"
                onClick={onAck}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors',
                  ack
                    ? 'border-op-border-strong bg-op-surface-3 text-op-fg hover:border-op-fg-3'
                    : 'border-op-accent-fill bg-op-accent-fill text-op-on-accent hover:bg-op-accent-fill/90',
                )}
              >
                {ack ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : <UserCheck className="h-3.5 w-3.5" aria-hidden />}
                {ack ? 'Ubah tanggapan' : 'Tanggapi'}
              </button>
            )}
            {onSelect && (
              <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors',
                  selected ? 'border-op-accent bg-op-accent/10 text-op-fg' : 'border-op-border-strong bg-op-surface-2 text-op-fg-2 hover:bg-op-surface-3 hover:text-op-fg',
                )}
              >
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
                Pratinjau WhatsApp
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
