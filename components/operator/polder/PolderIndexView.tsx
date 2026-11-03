'use client';

// Daftar polder: every polder ranked by flood probability at the chosen lead time.

import { Waves } from 'lucide-react';
import { useOpsSnapshot } from '@/lib/ops/hooks';
import { useMapLayerStore } from '@/lib/operator/mapLayerStore';
import { LeadTimeToggle } from '@/components/operator/ops/LeadTimeToggle';
import { PolderRankList } from '@/components/operator/ringkasan/PolderRankList';

export function PolderIndexView() {
  const snapshot = useOpsSnapshot();
  const lead = useMapLayerStore((s) => s.leadMin);

  return (
    <div className="min-h-full bg-op-page px-3 pb-6 pt-4 text-op-fg sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-op-fg-3" aria-hidden />
              <h1 className="font-heading text-lg font-bold">Polder</h1>
            </div>
            <p className="mt-1 text-xs text-op-fg-2">Pilih polder untuk melihat tinggi muka air, pompa dan rekomendasinya.</p>
          </div>
          <LeadTimeToggle />
        </div>
        <div className="rounded-lg border border-op-border bg-op-surface-1">
          <PolderRankList polders={snapshot?.polders ?? []} lead={lead} />
        </div>
      </div>
    </div>
  );
}
