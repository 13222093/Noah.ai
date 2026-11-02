'use client';

// Operator map shell, extracted from the old FloodMap (UI-005).
// It provides the Leaflet container, basemap switch, fullscreen and a slot
// for data layers. It renders no data of its own: every layer passed as
// children must carry its own source and timestamp (guardrail 7).
//
// Leaflet touches `window` at import time, so load this component with
// next/dynamic and `ssr: false`.

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer as _MapContainer, TileLayer as _TileLayer, useMap } from 'react-leaflet';
import { patchLeafletContainer } from '@/lib/leaflet-fix';
import { cn } from '@/lib/utils';
import { BASEMAPS, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants';
import { useMapLayerStore } from '@/lib/mapLayerStore';
import { MapControls } from './MapControls';

// react-leaflet's typings clash with this project's React types; keep the casts local.
const MapContainer = _MapContainer as any;
const TileLayer = _TileLayer as any;

patchLeafletContainer();

let mapInstanceCounter = 0;

function MapEffect({
  onMapLoad,
  isFullscreen,
}: {
  onMapLoad?: (map: any) => void;
  isFullscreen: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    onMapLoad?.(map);
  }, [map, onMapLoad]);
  // Leaflet needs a size recalculation whenever the container changes size.
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 50);
    return () => window.clearTimeout(id);
  }, [map, isFullscreen]);
  return null;
}

export interface OperatorMapProps {
  className?: string;
  height?: string;
  center?: [number, number];
  zoom?: number;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  showFullscreenButton?: boolean;
  onMapLoad?: (map: any) => void;
  /** Data layers (react-leaflet children). */
  children?: React.ReactNode;
  /** Overlays rendered above the map, outside the Leaflet pane (legends, notices). */
  overlay?: React.ReactNode;
}

export const OperatorMap = React.memo(function OperatorMap({
  className,
  height,
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  isFullscreen,
  onFullscreenToggle,
  showFullscreenButton,
  onMapLoad,
  children,
  overlay,
}: OperatorMapProps) {
  const { basemap, setBasemap } = useMapLayerStore();
  // Stable, unique key per mount (avoids "Map container is already initialized").
  const [mapKey] = useState(() => `operator-map-${++mapInstanceCounter}`);
  const layer = BASEMAPS[basemap];

  return (
    <div
      data-vaul-no-drag="true"
      className={cn(
        'relative overflow-hidden rounded-lg',
        isFullscreen && 'fixed inset-0 z-50 rounded-none bg-slate-900',
        className,
      )}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      <MapContainer
        key={mapKey}
        center={center}
        zoom={zoom}
        scrollWheelZoom
        doubleClickZoom={false}
        className="h-full w-full bg-slate-900"
        zoomControl={false}
        attributionControl
      >
        <MapEffect onMapLoad={onMapLoad} isFullscreen={isFullscreen} />
        <TileLayer key={basemap} attribution={layer.attribution} url={layer.url} />
        {children}
      </MapContainer>

      <MapControls
        basemap={basemap}
        onBasemapChange={setBasemap}
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
        showFullscreenButton={showFullscreenButton}
      />
      {overlay}
    </div>
  );
});

export default OperatorMap;
