import { create } from 'zustand';

interface MapLayerState {
  showFloodZones: boolean;
  showWeatherStations: boolean;
  showRadar: boolean;
  showAqi: boolean;
  showEvacPins: boolean;
  toggleFloodZones: () => void;
  toggleWeatherStations: () => void;
  toggleRadar: () => void;
  toggleAqi: () => void;
  toggleEvacPins: () => void;
  setShowRadar: (v: boolean) => void;
  setShowAqi: (v: boolean) => void;
}

export const useMapLayerStore = create<MapLayerState>((set) => ({
  showFloodZones: true,
  showWeatherStations: true,
  showRadar: false,
  showAqi: false,
  showEvacPins: true,
  toggleFloodZones: () =>
    set((s) => ({ showFloodZones: !s.showFloodZones })),
  toggleWeatherStations: () =>
    set((s) => ({ showWeatherStations: !s.showWeatherStations })),
  toggleRadar: () =>
    set((s) => ({ showRadar: !s.showRadar, showAqi: s.showRadar ? s.showAqi : false })),
  toggleAqi: () =>
    set((s) => ({ showAqi: !s.showAqi, showRadar: s.showAqi ? s.showRadar : false })),
  toggleEvacPins: () =>
    set((s) => ({ showEvacPins: !s.showEvacPins })),
  setShowRadar: (v) => set(v ? { showRadar: true, showAqi: false } : { showRadar: false }),
  setShowAqi: (v) => set(v ? { showAqi: true, showRadar: false } : { showAqi: false }),
}));
