'use client';

// Ringkasan (overview) placeholder for W1.
// Keeps the operator frame (tiling layout + map shell) and shows honest empty
// states until the real sources land in W2 (nowcast per polder, open
// recommendations, connector health). No numbers are shown on purpose:
// nothing here may be fabricated (guardrail 5) or labelled live.

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardCheck, Gauge, MapPinned, Waves } from 'lucide-react';
import { TilingLayout } from '@/components/tiling/TilingLayout';
import { TilePanel } from '@/components/tiling/TilePanel';
import type { SegmentedTab } from '@/components/tiling/SegmentedControl';
import { EmptyState } from '@/components/ui/empty-state';

const OperatorMap = dynamic(() => import('@/components/map/OperatorMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-xs text-slate-400">
      Memuat peta...
    </div>
  ),
});

const POLDER_TABS: SegmentedTab[] = [{ id: 'polder', label: 'Polder', icon: Waves }];
const REKOMENDASI_TABS: SegmentedTab[] = [{ id: 'rekomendasi', label: 'Rekomendasi', icon: ClipboardCheck }];
const KONEKTOR_TABS: SegmentedTab[] = [{ id: 'konektor', label: 'Kesehatan sumber data', icon: Gauge }];

function PolderEmpty() {
  return (
    <EmptyState
      icon={Waves}
      description="Peluang banjir per polder untuk 60, 120 dan 180 menit ke depan akan tampil di sini setelah sumber data tersambung."
    />
  );
}

function RekomendasiEmpty() {
  return (
    <EmptyState
      icon={ClipboardCheck}
      title="Belum ada rekomendasi"
      description="Rekomendasi bersifat saran. Keputusan tetap di tangan operator."
    />
  );
}

function KonektorEmpty() {
  return (
    <EmptyState
      icon={Gauge}
      description="Status tiap sumber data beserta waktu data terakhir (WIB) akan tampil di sini."
    />
  );
}

const MOBILE_TABS = [
  { id: 'polder', label: 'Polder', icon: <Waves size={16} /> },
  { id: 'rekomendasi', label: 'Rekomendasi', icon: <ClipboardCheck size={16} /> },
  { id: 'konektor', label: 'Sumber data', icon: <Gauge size={16} /> },
];

function renderMobileTab(tab: string) {
  switch (tab) {
    case 'polder':
      return <PolderEmpty />;
    case 'rekomendasi':
      return <RekomendasiEmpty />;
    case 'konektor':
      return <KonektorEmpty />;
    default:
      return null;
  }
}

function MapNotice() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] max-w-[260px] rounded-md border border-white/10 bg-slate-900/85 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
      <p className="flex items-center gap-1.5 font-medium text-slate-100">
        <MapPinned size={14} aria-hidden /> Lapisan data belum tersedia
      </p>
      <p className="mt-0.5 text-slate-400">Batas polder dan prakiraan akan ditambahkan pada tahap berikutnya.</p>
    </div>
  );
}

export function RingkasanView() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);

  return (
    <>
      <h1 className="sr-only">Ringkasan</h1>
      <TilingLayout
        left={
          <TilePanel tabs={POLDER_TABS} activeTab="polder" onTabChange={() => {}} className="h-full">
            <PolderEmpty />
          </TilePanel>
        }
        master={
          <OperatorMap
            isFullscreen={isFullscreen}
            onFullscreenToggle={toggleFullscreen}
            className="h-full w-full"
            overlay={<MapNotice />}
          />
        }
        right={
          <TilePanel tabs={REKOMENDASI_TABS} activeTab="rekomendasi" onTabChange={() => {}} className="h-full">
            <RekomendasiEmpty />
          </TilePanel>
        }
        bottom={
          <TilePanel tabs={KONEKTOR_TABS} activeTab="konektor" onTabChange={() => {}} className="h-full">
            <KonektorEmpty />
          </TilePanel>
        }
        mobileTabs={MOBILE_TABS}
        renderMobileTab={renderMobileTab}
      />
    </>
  );
}
