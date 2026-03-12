'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface EvacuationRoutingProps {
  start: [number, number]; // [lat, lng] — user location
  end: [number, number];   // [lat, lng] — evacuation shelter
  onClear?: () => void;
}

/**
 * Renders a driving route on the map between start and end using
 * leaflet-routing-machine (OSRM backend — free, public).
 */
const EvacuationRouting: React.FC<EvacuationRoutingProps> = ({ start, end, onClear }) => {
  const map = useMap();
  const routingControlRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !start || !end) return;

    // Dynamically import leaflet-routing-machine
    // @ts-ignore
    import('leaflet-routing-machine/dist/leaflet-routing-machine.css')
      .catch(() => {/* CSS may not be importable in all envs */});
    // @ts-ignore
    import('leaflet-routing-machine').then(() => {
      if (!map) return;

      // Remove previous route if any
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }

      const routingControl = (L as any).Routing.control({
        waypoints: [
          (L as any).latLng(start[0], start[1]),
          (L as any).latLng(end[0], end[1]),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        show: false,          // hide turn-by-turn panel
        createMarker: () => null, // don't add default markers
        lineOptions: {
          styles: [{ color: '#3B82F6', opacity: 0.85, weight: 5 }],
          extendToWaypoints: true,
          missingRouteTolerance: 10,
        },
      }).addTo(map);

      routingControlRef.current = routingControl;

      // Fit bounds to show the full route
      const bounds = (L as any).latLngBounds([
        (L as any).latLng(start[0], start[1]),
        (L as any).latLng(end[0], end[1]),
      ]);
      map.fitBounds(bounds, { padding: [60, 60] });
    });

    return () => {
      const ctrl = routingControlRef.current;
      if (ctrl && map) {
        setTimeout(() => {
          try {
            ctrl.setWaypoints([]);
            map.removeControl(ctrl);
          } catch { /* map may already be disposed */ }
          routingControlRef.current = null;
        }, 0);
      }
    };
  }, [map, start, end]);

  return null;
};

export default EvacuationRouting;
