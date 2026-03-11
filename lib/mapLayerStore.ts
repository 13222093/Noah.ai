import { create } from 'zustand';

interface MapLayerState {
  showFloodZones: boolean;
  showWeatherStations: boolean;
  toggleFloodZones: () => void;
  toggleWeatherStations: () => void;
}

export const useMapLayerStore = create<MapLayerState>((set) => ({
  showFloodZones: true,
  showWeatherStations: true,
  toggleFloodZones: () =>
    set((s) => ({ showFloodZones: !s.showFloodZones })),
  toggleWeatherStations: () =>
    set((s) => ({ showWeatherStations: !s.showWeatherStations })),
}));
