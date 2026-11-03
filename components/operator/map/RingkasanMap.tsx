'use client';

// The overview map: OperatorMap with the polder and station layers, the
// lead-time switch and the legend. Client-only (Leaflet); load with
// next/dynamic and ssr:false.

import { useCallback, useEffect, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { usePolders, useStations } from '@/lib/ops/hooks';
import { useRouter } from 'next/navigation';
import { MapPinned } from 'lucide-react';
import type { OpsSnapshot } from '@/lib/ops/types';
import { useMapLayerStore } from '@/lib/operator/mapLayerStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LeadTimeToggle } from '@/components/operator/ops/LeadTimeToggle';
import OperatorMap from './OperatorMap';
import { OpsLegend } from './OpsLegend';
import { PolderLayer, StationLayer } from './OpsLayers';

/** Pans to the station or polder a replay moment points at. */
function MapFocus() {
  const map = useMap();
  const focus = useMapLayerStore((s) => s.focus);
  const stations = useStations();
  const polders = usePolders();
  useEffect(() => {
    if (!focus) return;
    const target =
      focus.kind === 'station' ? stations.find((s) => s.id === focus.id) : polders.find((p) => p.id === focus.id);
    if (!target) return;
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 12), { duration: 0.8 });
    // Only react to a new focus request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);
  return null;
}

/** Hides polder names when zoomed out so nearby labels do not collide. */
function ZoomClass() {
  const map = useMap();
  const apply = useCallback(() => {
    map.getContainer().classList.toggle('ops-zoomed-out', map.getZoom() < 13);
  }, [map]);
  useMapEvents({ zoomend: apply });
  useEffect(() => apply(), [apply]);
  return null;
}

// Centre between the lighthouse polders (Setiabudi to Kelapa Gading, Bojong Indah).
const DESKTOP_CENTER: [number, number] = [-6.185, 106.83];

export default function RingkasanMap({ snapshot }: { snapshot: OpsSnapshot | null }) {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);
  const lead = useMapLayerStore((s) => s.leadMin);
  const showPolders = useMapLayerStore((s) => s.showPolders);
  const showStations = useMapLayerStore((s) => s.showStations);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const onSelect = useCallback((id: string) => router.push(`/operator/polder/${id}`), [router]);

  const empty = !snapshot || (snapshot.polders.length === 0 && snapshot.stations.length === 0);

  return (
    <OperatorMap
      isFullscreen={isFullscreen}
      onFullscreenToggle={toggleFullscreen}
      className="h-full w-full rounded-none"
      center={DESKTOP_CENTER}
      zoom={isMobile ? 11 : 12}
      overlay={
        <>
          <div className="pointer-events-auto absolute right-3 top-3 z-[1000] rounded-lg border border-op-border-strong bg-op-surface-1 px-2 py-1">
            <LeadTimeToggle label={isMobile ? null : 'Peluang banjir dalam'} />
          </div>
          {empty && (
            <div className="pointer-events-none absolute left-1/2 top-16 z-[1000] w-[min(90%,320px)] -translate-x-1/2 rounded-lg border border-op-border-strong bg-op-surface-1 px-3 py-2 text-xs text-op-fg-2">
              <p className="flex items-center gap-1.5 font-medium text-op-fg">
                <MapPinned size={14} aria-hidden /> Belum ada data untuk ditampilkan
              </p>
              <p className="mt-0.5 text-op-fg-3">Polder dan pos duga air muncul di peta setelah sumber data tersedia.</p>
            </div>
          )}
          <OpsLegend
            key={isMobile ? 'm' : 'd'}
            defaultOpen={!isMobile}
            className={isMobile ? 'bottom-[76px] left-3' : 'bottom-4 left-4'}
          />
        </>
      }
    >
      <MapFocus />
      <ZoomClass />
      {snapshot && showPolders && <PolderLayer polders={snapshot.polders} lead={lead} onSelect={onSelect} />}
      {snapshot && showStations && <StationLayer stations={snapshot.stations} />}
    </OperatorMap>
  );
}
