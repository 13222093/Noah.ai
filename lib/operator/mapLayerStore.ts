import { create } from 'zustand';
import { DEFAULT_BASEMAP, type BasemapId } from '@/lib/operator/basemaps';
import type { LeadMin } from '@/lib/ops/types';

// Map and view state shared by the operator screens (/operator/**): basemap,
// the selected lead time (60/120/180 min) and which data layers are visible.
// Separate from the original app's lib/mapLayerStore.ts, which is unchanged.
interface MapLayerState {
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  /** Lead time the map and the polder ranking colour by. */
  leadMin: LeadMin;
  setLeadMin: (lead: LeadMin) => void;
  showPolders: boolean;
  showStations: boolean;
  toggleLayer: (layer: 'polders' | 'stations') => void;
  /** Ask the overview map to pan to a station or polder (e.g. after a replay jump). */
  focus: { kind: 'station' | 'polder'; id: string; nonce: number } | null;
  focusOn: (kind: 'station' | 'polder', id: string) => void;
}

export const useMapLayerStore = create<MapLayerState>((set) => ({
  basemap: DEFAULT_BASEMAP,
  setBasemap: (basemap) => set({ basemap }),
  leadMin: 120,
  setLeadMin: (leadMin) => set({ leadMin }),
  showPolders: true,
  showStations: true,
  toggleLayer: (layer) =>
    set((s) => (layer === 'polders' ? { showPolders: !s.showPolders } : { showStations: !s.showStations })),
  focus: null,
  focusOn: (kind, id) => set((s) => ({ focus: { kind, id, nonce: (s.focus?.nonce ?? 0) + 1 } })),
}));

/** Pan the overview map to the station or polder a replay moment refers to. */
export function focusMoment(m: { stationId?: string; polderId?: string }) {
  const { focusOn } = useMapLayerStore.getState();
  if (m.stationId) focusOn('station', m.stationId);
  else if (m.polderId) focusOn('polder', m.polderId);
}
