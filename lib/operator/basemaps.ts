// lib/operator/basemaps.ts
//
// Map constants for the operator section (/operator/**) only. Kept apart from
// the original app's lib/constants.ts so the old maps are unchanged.

/** Map centre for DKI Jakarta. */
export const DEFAULT_MAP_CENTER: [number, number] = [-6.2, 106.816];
export const DEFAULT_MAP_ZOOM = 11;

export type BasemapId = 'dark' | 'darkEsri' | 'street' | 'satellite' | 'terrain';

/**
 * CARTO basemap key (free; https://www.carto.com/basemaps/apikey/). Without
 * it CARTO draws "API KEY REQUIRED" over every tile, so the CARTO option is
 * hidden and Esri becomes the default. Tile keys are public by design (they
 * reach the browser); restrict the key to your domains in CARTO's dashboard.
 * Keep the literal `process.env.NEXT_PUBLIC_...` access so Next can inline it.
 */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim() || '';

interface Basemap {
  name: string;
  url: string;
  attribution: string;
  /** Optional label layer drawn on top. */
  labelsUrl?: string;
}

/**
 * Basemaps. Free tiles only. CARTO's free tier is 5M tile requests/month
 * non-commercial, 1M commercial; a production deployment must confirm
 * CARTO's terms.
 */
const ALL_BASEMAPS: Record<BasemapId, Basemap> = {
  // CARTO Dark Matter: near-black like the rest of the UI. Needs CARTO_KEY.
  dark: {
    name: 'Gelap (CARTO)',
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  // Fallback if CARTO is unavailable: Esri Dark Gray Canvas (a lighter grey).
  darkEsri: {
    name: 'Gelap (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
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

/** Basemaps offered in the switcher: CARTO only when a key is configured. */
export const BASEMAPS: Partial<Record<BasemapId, Basemap>> = CARTO_KEY
  ? ALL_BASEMAPS
  : Object.fromEntries(Object.entries(ALL_BASEMAPS).filter(([id]) => id !== 'dark'));

/** CARTO Dark Matter when a key is set, otherwise Esri Dark Gray. */
export const DEFAULT_BASEMAP: BasemapId = CARTO_KEY ? 'dark' : 'darkEsri';

/** Look up a basemap, falling back to the default if it is not offered. */
export function getBasemap(id: BasemapId): Basemap {
  return BASEMAPS[id] ?? ALL_BASEMAPS[DEFAULT_BASEMAP];
}
