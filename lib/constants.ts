// lib/constants.ts
//
// UI constants only. No mock or sample data belongs here (guardrail 5):
// all fabricated alerts, zones, stations, shelters, CCTV channels and
// reports were removed in W1 (B-019, B-020, B-021).

/** Map centre for DKI Jakarta. */
export const DEFAULT_MAP_CENTER: [number, number] = [-6.2, 106.816];
export const DEFAULT_MAP_ZOOM = 11;

/** Rough DKI Jakarta bounds, for fitBounds and to restrict panning later. */
export const JAKARTA_BOUNDS: [[number, number], [number, number]] = [
  [-6.38, 106.68], // south-west
  [-6.07, 106.98], // north-east
];

/** Colour tokens for probability / risk classes. Labels are defined with the data. */
export const FLOOD_RISK_COLORS = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#7C2D12',
};

export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

export type BasemapId = 'dark' | 'street' | 'satellite' | 'terrain';

/**
 * Basemaps. Free tiles only (guardrail 14). Usage policy for a government
 * deployment is still open (audit Q4); self-hosting may replace these.
 */
export const BASEMAPS: Record<BasemapId, { name: string; url: string; attribution: string }> = {
  dark: {
    name: 'Gelap',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  street: {
    name: 'Jalan',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  terrain: {
    name: 'Topografi',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};
