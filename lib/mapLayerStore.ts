import { create } from 'zustand';
import type { BasemapId } from '@/lib/constants';

// Map layer state. All old overlays (flood-zone mock, weather stations,
// AQI, evacuation pins, RainViewer radar) were removed in W1.
// Real layers (polders, nowcast, BPBD reports, stations, pumps) are added
// here in W2 as their data sources come online.
interface MapLayerState {
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
}

export const useMapLayerStore = create<MapLayerState>((set) => ({
  basemap: 'dark',
  setBasemap: (basemap) => set({ basemap }),
}));
