'use client';

// Ringkasan (overview). Map with polders coloured by flood probability and
// water-level posts coloured by the recorded Siaga status, a ranked polder
// list, open recommendations and data-source freshness. Everything is read at
// the replay time through lib/ops/hooks; empty data shows honest empty states.

import React from 'react';
import dynamic from 'next/dynamic';
import { ClipboardCheck, Gauge, Waves } from 'lucide-react';
import { TilingLayout } from '@/components/operator/tiling/TilingLayout';
import { useOpsSnapshot, usePolders } from '@/lib/ops/hooks';
import { useMapLayerStore } from '@/lib/operator/mapLayerStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LeadTimeToggle } from '@/components/operator/ops/LeadTimeToggle';
import type { OpsSnapshot, PolderUnit } from '@/lib/ops/types';
import { PolderRankList } from './PolderRankList';
import { RecommendationSummary } from './RecommendationSummary';
import { ConnectorHealthStrip } from './ConnectorHealthStrip';

const RingkasanMap = dynamic(() => import('@/components/operator/map/RingkasanMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-op-page text-xs text-op-fg-3">
      Memuat peta...
    </div>
  ),
});

function PanelScroll({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto overflow-x-hidden">{children}</div>;
}

function Divider() {
  return <div className="mx-3 border-t border-op-border" />;
}

function PoldersPanel({ snapshot }: { snapshot: OpsSnapshot | null }) {
  const lead = useMapLayerStore((s) => s.leadMin);
  return <PolderRankList polders={snapshot?.polders ?? []} lead={lead} />;
}

function RecsPanel({ snapshot, units }: { snapshot: OpsSnapshot | null; units: PolderUnit[] }) {
  return <RecommendationSummary open={snapshot?.openRecommendations ?? []} polders={units} />;
}

function HealthPanel({ snapshot }: { snapshot: OpsSnapshot | null }) {
  return <ConnectorHealthStrip health={snapshot?.health ?? []} />;
}

const MOBILE_TABS = [
  { id: 'polder', label: 'Polder', icon: <Waves size={16} /> },
  { id: 'rekomendasi', label: 'Rekomendasi', icon: <ClipboardCheck size={16} /> },
  { id: 'konektor', label: 'Sumber data', icon: <Gauge size={16} /> },
];

export function RingkasanView() {
  const snapshot = useOpsSnapshot();
  const units = usePolders();
  const isWide = useMediaQuery('(min-width: 1280px)');

  const renderMobileTab = (tab: string) => {
    switch (tab) {
      case 'polder':
        return (
          <>
            <div className="px-3 pt-2">
              <LeadTimeToggle />
            </div>
            <PoldersPanel snapshot={snapshot} />
          </>
        );
      case 'rekomendasi':
        return <RecsPanel snapshot={snapshot} units={units} />;
      case 'konektor':
        return <HealthPanel snapshot={snapshot} />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1 className="sr-only">Ringkasan</h1>
      <TilingLayout
        leftWidth={340}
        rightWidth={360}
        left={
          isWide ? (
            <PanelScroll>
              <PoldersPanel snapshot={snapshot} />
            </PanelScroll>
          ) : undefined
        }
        master={<RingkasanMap snapshot={snapshot} />}
        right={
          <PanelScroll>
            {!isWide && (
              <>
                <PoldersPanel snapshot={snapshot} />
                <Divider />
              </>
            )}
            <RecsPanel snapshot={snapshot} units={units} />
            <Divider />
            <HealthPanel snapshot={snapshot} />
          </PanelScroll>
        }
        mobileTabs={MOBILE_TABS}
        renderMobileTab={renderMobileTab}
      />
    </>
  );
}
