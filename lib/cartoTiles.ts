// CARTO now draws "API KEY REQUIRED" over keyless tiles. With a key
// (NEXT_PUBLIC_CARTO_BASEMAP_KEY, free at https://www.carto.com/basemaps/apikey/)
// the dark map keeps its CARTO Dark Matter look; without one it falls back to
// Esri's dark grey canvas so no watermark appears.
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim() || '';

export const DARK_TILE_URL = CARTO_KEY
  ? `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
