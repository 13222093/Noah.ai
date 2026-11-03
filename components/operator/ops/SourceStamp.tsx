'use client';

// Provenance line for any value on screen (guardrail 7): what kind of data it
// is, where it comes from and how old it is, measured against the replay
// clock. Stale data is greyed out.

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlaybackStore } from '@/lib/ops/playback';
import type { Provenance } from '@/lib/ops/types';
import { formatAgeId, formatWibTime } from '@/lib/time';
import { PROVENANCE_CHIP, PROVENANCE_ICON, PROVENANCE_LABEL, STALE_AFTER_MIN } from './meta';

export function SourceStamp({
  provenance,
  stale,
  staleAfterMin,
  timeLabel = 'data terakhir',
  compact = false,
  className,
}: {
  provenance: Provenance | null | undefined;
  /** Overrides the age-based check (e.g. from ConnectorHealth.stale). */
  stale?: boolean;
  /** Defaults to the cadence of the source kind (STALE_AFTER_MIN). */
  staleAfterMin?: number;
  timeLabel?: string;
  /** One line, no source name (for tight rows); the full line is in the title. */
  compact?: boolean;
  className?: string;
}) {
  const nowMs = usePlaybackStore((s) => s.nowMs);

  if (!provenance) {
    return <span className={cn('text-[11px] text-op-fg-3', className)}>Sumber belum tersedia</span>;
  }

  const tsMs = Date.parse(provenance.ts);
  const ageMin = nowMs === null || Number.isNaN(tsMs) ? null : Math.floor((nowMs - tsMs) / 60_000);
  const isStale = stale ?? (ageMin !== null && ageMin > (staleAfterMin ?? STALE_AFTER_MIN[provenance.kind]));
  const time = Number.isNaN(tsMs) ? '–' : formatWibTime(tsMs);
  const age = nowMs !== null && !Number.isNaN(tsMs) ? formatAgeId(tsMs, nowMs) : null;
  const model =
    provenance.modelVersion && !provenance.source.includes(provenance.modelVersion) ? ` · ${provenance.modelVersion}` : '';
  const Icon = PROVENANCE_ICON[provenance.kind];
  const full = `${PROVENANCE_LABEL[provenance.kind]} · ${provenance.source}${model} · ${timeLabel} ${time}${age ? ` (${age})` : ''}${isStale ? ' · data sudah lama' : ''}`;

  return (
    <span
      title={full}
      className={cn(
        'inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-op-fg-2',
        isStale && 'text-op-fg-disabled',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-sm border px-1 py-px text-[10px] font-semibold uppercase tracking-[0.06em]',
          PROVENANCE_CHIP[provenance.kind],
        )}
      >
        <Icon className="h-2.5 w-2.5" aria-hidden />
        {PROVENANCE_LABEL[provenance.kind]}
      </span>
      {!compact && (
        <span className="min-w-0 truncate">
          {provenance.source}
          {model}
        </span>
      )}
      <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
        <Clock className="h-3 w-3" aria-hidden />
        {timeLabel} {time}
        {age && !compact && <span className={isStale ? undefined : 'text-op-fg-3'}>({age})</span>}
      </span>
      {isStale && <span className="shrink-0 font-semibold text-op-fg-2">data sudah lama</span>}
    </span>
  );
}
