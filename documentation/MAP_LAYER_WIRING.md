# Map Layer Wiring — Implementation Report

> **Date:** 2026-03-12  
> **Scope:** Wire orphaned Floodzy map components into noah.ai dashboard  
> **Status:** ✅ Complete (tsc exit code 0)

---

## Background

After analyzing the Floodzy codebase (see `MAP_FEATURE_ANALYSIS.md`), we discovered that noah.ai **already had all Floodzy map components copied** into `components/map/` and `components/weather/` — but none of them were wired into the dashboard. The only map component actually rendered was `FloodMap` via `TilingLayout.tsx:126`.

### Orphaned Components Found

| Component | File | What It Does |
|-----------|------|-------------|
| `RadarLayer` | `components/map/RadarLayer.tsx` | RainViewer tile overlay with frame pre-loading |
| `TimelineScrubber` | `components/map/TimelineScrubber.tsx` | Play/pause/scrub radar timeline with gradient track |
| `MockAQILayer` | `components/map/MockAQILayer.tsx` | 28 Indonesian cities with color-coded AQI markers |
| `WeatherInsightMap` | `components/map/WeatherInsightMap.tsx` | Combined radar+AQI orchestrator (not used) |
| `EvacuationRouting` | `components/peta-banjir/EvacuationRouting.tsx` | leaflet-routing-machine polyline routes |
| `MapLayerControls` | `components/weather/MapLayerControls.tsx` | OWM weather tile toggle buttons |

---

## Architecture Decision

### Control Surfaces — Option 1 + Option 2

We chose a **two-surface approach**:

1. **Top Tile Button Bar** (`TilingStatusBar.tsx`) — Primary quick-access toggles visible at all times
2. **Left Tile Map Layers Tab** (`LeftTile.tsx`) — Detailed checkbox panel for granular control

Both surfaces read from the **same Zustand store** (`mapLayerStore.ts`), so they stay perfectly in sync.

### Why Not Floating Map Controls (Option 3)?
User rejected Option 3 (floating buttons on the map itself, like Floodzy does) because it would make the map too crowded given noah.ai's tiling layout already has tight space.

### Mutual Exclusivity
Radar and AQI are **mutually exclusive** — toggling one automatically disables the other. This prevents visual clutter from overlapping tile layers.

---

## Files Modified

### 1. `lib/mapLayerStore.ts` — Extended Zustand Store

**Before:** 2 boolean states (`showFloodZones`, `showWeatherStations`) + 2 toggles  
**After:** 5 boolean states + 5 toggles + 2 setters

```typescript
// New state fields
showRadar: boolean;      // RainViewer radar overlay
showAqi: boolean;        // AQI bubble markers
showEvacPins: boolean;   // Evacuation shelter pins

// Mutual exclusivity logic
toggleRadar: () =>
  set((s) => ({ showRadar: !s.showRadar, showAqi: s.showRadar ? s.showAqi : false })),
toggleAqi: () =>
  set((s) => ({ showAqi: !s.showAqi, showRadar: s.showAqi ? s.showRadar : false })),
```

---

### 2. `components/tiling/TilingStatusBar.tsx` — Center Button Bar

Added a center section between the NOAH.AI brand (left) and the clock/controls (right) with 4 pill-shaped toggle buttons:

| Button | Icon | Active Color | Store Field |
|--------|------|-------------|-------------|
| Radar | `CloudRain` | `cyan-500/20` | `showRadar` |
| AQI | `Wind` | `emerald-500/20` | `showAqi` |
| Floods | `Layers` | `amber-500/20` | `showFloodZones` |
| Evac | `MapPin` | `red-500/20` | `showEvacPins` |

Labels are hidden on small screens (`hidden sm:inline`) to prevent crowding.  
Labels use i18n keys (`t('mapLayers.radar')`, etc.).

---

### 3. `components/tiling/LeftTile.tsx` — Extended Map Layers Tab

Replaced 4 basic checkboxes (2 wired, 2 dummy) with 5 fully wired checkboxes:

- 🌧 **Radar Overlay** → `showRadar` / `toggleRadar` (accent-cyan)
- 💨 **AQI Bubbles** → `showAqi` / `toggleAqi` (accent-emerald)
- **Flood Zones** → `showFloodZones` / `toggleFloodZones` (accent-amber)
- **Weather Stations** → `showWeatherStations` / `toggleWeatherStations` (accent-blue)
- 📍 **Evacuation Pins** → `showEvacPins` / `toggleEvacPins` (accent-red)

---

### 4. `components/map/FloodMap.tsx` — Core Map Wiring

This was the most significant change. Added:

#### New Imports
```typescript
import { RadarLayer } from '@/components/map/RadarLayer';
import { TimelineScrubber } from '@/components/map/TimelineScrubber';
import { MockAQILayer } from '@/components/map/MockAQILayer';
```

#### Radar State Management (~40 lines)
- `radarFrames`, `radarHost`, `radarIndex`, `radarPlaying`, `radarLoaded`, `radarLoading`
- **Lazy fetch:** Only calls RainViewer API when `showRadar` first becomes `true`
- **API:** `https://api.rainviewer.com/public/weather-maps.json` (FREE, no key needed)
- Processes `data.radar.past[]` + `data.radar.nowcast[]` into unified frame array
- Tags frames with `isPast: true/false` for observation vs prediction styling
- Animation loop: 1-second interval when playing

#### RadarLayer Rendering (inside `<MapContainer>`)
```tsx
{showRadar && radarFrames.length > 0 && (
  <RadarLayer
    frames={radarFrames}
    currentIndex={radarIndex}
    host={radarHost}
    opacity={radarFrames[radarIndex]?.isPast === false ? 0.6 : 0.75}
    visible={true}
  />
)}
```
- Forecast frames render at lower opacity (0.6) to indicate uncertainty
- `RadarLayer` pre-loads ±2 adjacent frames for smooth playback

#### MockAQILayer Rendering (inside `<MapContainer>`)
```tsx
{showAqi && (
  <MockAQILayer visible={true} />
)}
```
- Shows 28 Indonesian cities with color-coded circle markers
- Green (≤50), Yellow (≤100), Orange (≤150), Red (>150)
- Pulses if AQI > 100

#### TimelineScrubber Overlay (floating, outside `<MapContainer>`)
```tsx
{showRadar && (
  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
    <TimelineScrubber
      frames={radarFrames}
      currentIndex={radarIndex}
      isPlaying={radarPlaying}
      onTogglePlay={() => setRadarPlaying(!radarPlaying)}
      onScrub={(index) => { setRadarPlaying(false); setRadarIndex(index); }}
      isLoading={radarLoading}
    />
  </div>
)}
```
- Collapsible pill at bottom center of map
- Play/pause button + slider scrub + time display (WIB)
- Gradient track: cyan for past frames, purple for forecast

---

### 5. i18n Keys — `src/i18n/en.ts` and `src/i18n/id.ts`

Added `mapLayers` namespace:

| Key | English | Indonesian |
|-----|---------|-----------|
| `mapLayers.radar` | Radar | Radar |
| `mapLayers.aqi` | AQI | AQI |
| `mapLayers.floodZones` | Floods | Banjir |
| `mapLayers.evacPins` | Evac | Evakuasi |
| `mapLayers.weatherStations` | Stations | Stasiun |

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    mapLayerStore (Zustand)                │
│  showRadar │ showAqi │ showFloodZones │ showEvacPins │...│
└───────┬──────────┬────────────┬────────────┬─────────────┘
        │          │            │            │
        ▼          ▼            ▼            ▼
 TilingStatusBar  LeftTile    FloodMap    (future)
  (top buttons)  (checkboxes)  (renders)
        │          │            │
        │          │     ┌──────┴──────┐
        │          │     ▼             ▼
        │          │  RadarLayer  MockAQILayer
        │          │     │
        │          │     ▼
        │          │  TimelineScrubber
        │          │  (floating overlay)
        └──────────┘
     (both read/write same store → always in sync)
```

---

## RainViewer API Details

- **Endpoint:** `https://api.rainviewer.com/public/weather-maps.json`
- **Cost:** FREE (no API key)
- **Response:** `{ host, radar: { past: [{path, time}], nowcast: [{path, time}] } }`
- **Tile URL:** `{host}{frame.path}/256/{z}/{x}/{y}/2/1_1.png`
- **Coverage:** Global radar data
- **Update frequency:** ~10 minutes
- **Past frames:** ~12 (2 hours of history)
- **Nowcast frames:** ~3 (30 minutes of prediction)

---

## Verification

`npx tsc --noEmit` → **exit code 0** ✅

---

## Future Work

- [ ] Wire `showEvacPins` to actual evacuation shelter markers on the map
- [ ] Add water level station colored markers (from `waterLevelPosts`)
- [ ] Replace `MockAQILayer` data with live WAQI API calls
- [ ] Add flood status badge ("ZONA AMAN" / "Waspada") to top-right of map
