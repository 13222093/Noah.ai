# MAP FEATURE ANALYSIS — Floodzy vs noah.ai

## Critical Discovery

noah.ai already has **ALL** Floodzy map components copied into `components/map/` and `components/weather/`:

| Component | Floodzy Source | noah.ai Copy | Wired? |
|-----------|---------------|-------------|--------|
| `RadarLayer.tsx` | RainViewer tile overlays | ✅ Exists | ❌ No |
| `MockAQILayer.tsx` | 28-city AQI circle markers | ✅ Exists | ❌ No |
| `TimelineScrubber.tsx` | Play/pause/scrub radar timeline | ✅ Exists | ❌ No |
| `WeatherInsightMap.tsx` | Combined radar+AQI map | ✅ Exists | ❌ No |
| `EvacuationRouting.tsx` | leaflet-routing-machine routes | ✅ Exists | ❌ No |
| `MapLayerControls.tsx` | OWM weather tile toggles | ✅ Exists | ❌ No |
| `InteractiveWeatherMap.tsx` | Radar/AQI mode switcher | ✅ Exists | ❌ No |
| `FloodMap.tsx` | Full flood map (zones, alerts, search) | ✅ Exists | ✅ **Used** |

**The dashboard center tile (`TilingLayout.tsx:126`) only renders `FloodMap`.** Everything else is orphaned code.

---

## Floodzy Map Architecture (How Each Feature Works)

### 1. RainViewer Radar Overlay
**File:** `RadarLayer.tsx` (82 lines)
**API:** `https://api.rainviewer.com/public/weather-maps.json` (FREE, no key)

- Fetches JSON with `data.radar.past[]` and `data.radar.nowcast[]` frame arrays
- Each frame has a `path` and `time` timestamp
- Tiles: `{host}{frame.path}/256/{z}/{x}/{y}/2/1_1.png`
- Pre-loads adjacent frames (current ± 2) for smooth playback
- Manages layer opacity: only current frame visible, others at 0
- Cleanup on unmount to prevent memory leaks

### 2. AQI Heatmap Bubbles
**File:** `MockAQILayer.tsx` (288 lines)

- **Mock data**: 28 Indonesian cities with lat/lon + AQI value
- Custom `L.divIcon` with color-coded circles (green → yellow → orange → red)
- Pulses if AQI > 100
- Click handler shows `AQIDetailCard` — glassmorphism popup with PM2.5, wind, status
- Color scale: Baik (≤50), Sedang (≤100), Buruk (≤150), Bahaya (>150)

### 3. Timeline Scrubber
**File:** `TimelineScrubber.tsx` (213 lines)

- Collapsible pill: minimized shows "Radar ↑", expanded shows full controls
- Play/pause with auto-advance (1s intervals)
- Slider scrub with throttled (32ms) updates
- Gradient track: cyan for past frames, purple for forecast frames
- "NOW" marker divides observation from prediction
- WIB time display

### 4. Weather Layer Toggles
**File:** `MapLayerControls.tsx` (42 lines) + `FloodMap.tsx:623-635`

- OWM tile layers: `precipitation_new`, `clouds_new`, `temp_new`, `wind_new`
- URL pattern: `https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png?appid={key}`
- Toggle on/off via button group
- Also supports proxy tiles via `/api/weather/tiles/` route

### 5. Evacuation Routing
**File:** `EvacuationRouting.tsx` (64 lines)

- Uses `leaflet-routing-machine` (dynamically imported)
- Takes `start` and `end` lat/lon pairs
- Draws blue polyline route (weight 6, opacity 0.8)
- Uses OSRM backend (default, free)
- Cleanup: removes waypoints + control on unmount

### 6. Flood Zone Polygons
**File:** `FloodMap.tsx:730-789`

- `FLOOD_ZONES_MOCK` data with risk levels (high/medium/low)
- Colored `<Polygon>` overlays with popups showing name, area, population
- Severity icons: 💀 Critical, 🚨 High, ⛰️ Medium (landslide), 💧 Low

### 7. WeatherInsightMap (Orchestrator)
**File:** `WeatherInsightMap.tsx` (463 lines)

- Combines `RadarLayer` + `MockAQILayer` + `TimelineScrubber`
- Mode switch: `radar` | `aqi`
- Status badge: "ZONA AMAN" (green) or "Waspada (N)" (red pulsing) based on `activeFloodCount`
- Fullscreen toggle
- `WeatherLegend` component for gradient scales
- Zoom-gated AQI: only shows data points when zoom ≥ 7

---

## Gap Analysis — What noah.ai's Dashboard Map Is Missing

### Currently Active
| Feature | Status |
|---------|--------|
| Base map tiles (OSM/Carto) | ✅ Working |
| Flood zone polygons (mock) | ✅ Working |
| Search bar | ✅ Working |
| Marker popups | ✅ Working |

### Orphaned Components (Exist but Not Wired)
| Feature | Component | Impact | Effort |
|---------|-----------|--------|--------|
| **RainViewer radar** | `RadarLayer` + `WeatherInsightMap` | 🔴 Highest | ~30min wire |
| **AQI bubbles** | `MockAQILayer` | 🟡 Medium | ~20min wire |
| **Radar timeline** | `TimelineScrubber` | 🟡 Medium | wires with radar |
| **Weather legend** | `WeatherLegend` | 🟢 Low | wires with radar |
| **Evacuation route** | `EvacuationRouting` | 🟡 Medium | ~30min wire + UI |
| **Weather layers** | `MapLayerControls` | 🟢 Low | ~15min wire |

### Missing Entirely
| Feature | From Floodzy | Needed? |
|---------|-------------|---------|
| Evacuation shelter pins on dashboard map | `/evacuation` has data, not on map | ✅ Yes — high judge impact |
| Water level station colored markers | Only basic pins now | ✅ Yes — makes map functional |
| Flood status badge ("ZONA AMAN") | In `WeatherInsightMap` but not wired | ✅ Yes — shows real-time status |
| Report filter panel | `MapFilterControl.tsx` exists | 🟡 Nice to have |

---

## Recommended Implementation Order

### Priority 1 — Wire Existing Components (~45 min)
The fastest path to judge impact: replace `FloodMap` with `WeatherInsightMap` in the dashboard center tile, or inject `RadarLayer` + `TimelineScrubber` into the existing `FloodMap`.

**Option A (Safer):** Add `RadarLayer` + `TimelineScrubber` directly into `FloodMap.tsx`
- Import the two components
- Add radar state management (fetch from RainViewer API)
- Render `<RadarLayer>` inside `<MapContainer>`
- Render `<TimelineScrubber>` as overlay
- **Outcome:** Radar + timeline on dashboard map, no layout disruption

**Option B (Full swap):** Replace center tile to use `WeatherInsightMap`
- Riskier — different component tree, might need prop adjustments
- But gets radar + AQI + timeline + legend + status badge in one shot

### Priority 2 — Evacuation Pins on Map (~20 min)
- Import evacuation data from the existing `/evacuation/page.tsx`
- Add a toggleable marker layer to `FloodMap`
- Red pins with shelter name + capacity popup

### Priority 3 — Water Level Station Markers (~25 min)
- Use `waterLevelPosts` from `useDashboardData()`
- Create color-coded circle markers (like AQI but for water levels)
- Green (Normal), Yellow (Siaga), Red (Bahaya)

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| RainViewer API rate limits | Free API, generous limits, cache response |
| `leaflet-routing-machine` not installed | Check `package.json` — may need `npm install` |
| OWM weather tiles need API key | Key already in env (`OPENWEATHER_API_KEY`) |
| Layout breakage if swapping center tile | Use Option A (additive) not Option B (swap) |
