'use client';

// One recommendation: action, polder, probability, window (WIB), reason,
// provenance, and the operator's answer once given. Always framed as advice.

import Link from 'next/link';
import { MessageSquareText, Pencil, UserCheck } from 'lucide-react';
import type { Acknowledgement, Recommendation } from '@/lib/ops/types';
import type { RecStatus } from '@/hooks/useOps';
import { cn } from '@/lib/utils';
import { formatWibTime } from '@/lib/time';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { ACTION_LABEL, OPERATOR_ACTION_META, RECIPIENT_LABEL, formatPct } from '@/components/operator/ops/meta';

// Status chips, tinted pills like the dashboard's badges (risk colours stay on
// the risk scale): open = accent tint, answered = neutral, past = muted.
const STATUS_META: Record<RecStatus, { label: string; cls: string }> = {
  terbuka: { label: 'Terbuka', cls: 'bg-op-accent/20 text-op-fg' },
  ditanggapi: { label: 'Ditanggapi', cls: 'bg-white/10 text-op-fg-2' },
  lewat: { label: 'Lewat waktu', cls: 'bg-white/5 text-op-fg-3' },
};

function windowText(rec: Recommendation): string {
  return `${formatWibTime(rec.windowStart).replace(' WIB', '')}–${formatWibTime(rec.windowEnd)}`;
}

export function AckLine({ ack }: { ack: Acknowledgement }) {
  const meta = OPERATOR_ACTION_META[ack.action];
  return (
    <div className="flex items-start gap-2 rounded-md border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-xs">
      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-op-fg-3" aria-hidden />
      <div className="min-w-0">
        <p className="tabular-nums text-op-fg-2">
          <span className={cn('mr-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold', meta.chip)}>{meta.label}</span>
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
        'rounded-lg border bg-op-surface-2 transition-colors',
        selected ? 'border-op-accent ring-1 ring-op-accent' : 'border-white/5',
        status === 'lewat' && !selected && 'opacity-75',
      )}
    >
      <div className={cn('space-y-2', compact ? 'px-2.5 py-2' : 'px-3 py-2.5')}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-wider', st.cls)}>{st.label}</span>
              <span className="text-[10px] text-op-fg-2">untuk {RECIPIENT_LABEL[rec.recipient]}</span>
            </div>
            <h3 className={cn('mt-1 font-semibold leading-tight text-op-fg', compact ? 'text-xs' : 'text-[13px]')}>{rec.title}</h3>
            <p className="mt-0.5 text-[11px] text-op-fg-2">
              <Link href={`/operator/polder/${rec.polderId}`} className="text-blue-400 transition-colors hover:text-blue-300">
                {polderName}
              </Link>{' '}
              · {ACTION_LABEL[rec.actionType]}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn('font-bold leading-none tabular-nums text-op-fg', compact ? 'text-base' : 'text-xl')}>
              {formatPct(rec.probability)}
            </p>
            <p className="mt-1 text-[9px] tabular-nums text-op-fg-3">peluang dalam {rec.leadMin} mnt</p>
          </div>
        </div>

        <p className="text-[11px] tabular-nums text-op-fg">
          <span className="text-op-fg-3">Jendela waktu </span>
          {windowText(rec)}
        </p>
        {!compact && <p className="text-xs leading-snug text-op-fg-2">{rec.reason}</p>}

        {ack && <AckLine ack={ack} />}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <SourceStamp provenance={rec.provenance} timeLabel="terbit" stale={false} />
          <p className="text-[10px] italic text-op-fg-3">Saran — keputusan di tangan operator</p>
        </div>

        {(onAck || onSelect) && (
          <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
            {onAck && (
              <button
                type="button"
                onClick={onAck}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
                  ack
                    ? 'border border-white/10 bg-white/5 text-op-fg hover:bg-white/10'
                    : 'bg-op-accent-fill text-op-on-accent shadow-sm hover:bg-op-accent-fill/90',
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
                  'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                  selected ? 'border-op-accent/40 bg-op-accent/15 text-op-fg' : 'border-white/10 bg-transparent text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
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
