# Implementation Plan: Hyprland Tiling Command Center (v1.1)

**Based on**: `TILING_LAYOUT_PRD.md` v1.1
**Date**: March 11, 2026
**Revised**: Addresses 5 blockers from review + non-blocking issues

---

## Pre-Implementation Blocker Resolutions

### Blocker 1 — useSearchParams Needs Suspense ✅ RESOLVED

**Problem**: Adding `useSearchParams()` to `ClientLayoutWrapper` opts the entire app out of static rendering and causes a missing Suspense boundary build error.

**Fix**: Do NOT use `useSearchParams` in `ClientLayoutWrapper`. Instead, the feature flag check lives **in `dashboard/page.tsx`** (server component), which reads `searchParams` from the page props (Next.js provides this for free in server components):

```tsx
// dashboard/page.tsx — server component
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const params = await searchParams;
  const useTiling = params.layout === 'tiling';

  if (useTiling) {
    return (
      <DashboardDataProvider data={initialData}>
        <TilingLayout />
      </DashboardDataProvider>
    );
  }
  return <CommandCenterView initialData={initialData} />;
}
```

No Suspense needed. No changes to `ClientLayoutWrapper`.

---

### Blocker 2 — DashboardDataContext Can't Wrap From Server Component ✅ RESOLVED

**Problem**: `dashboard/page.tsx` is a server component — can't use React Context providers directly.

**Fix**: `DashboardDataProvider` is a `'use client'` component. The server component renders it and passes `initialData` as a serializable prop:

```tsx
// components/tiling/DashboardDataContext.tsx
'use client';
import { createContext, useContext, ReactNode } from 'react';

interface DashboardData { /* matches initialData shape */ }

const DashboardDataContext = createContext<DashboardData | null>(null);

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error('useDashboardData must be used within DashboardDataProvider');
  return ctx;
}

export function DashboardDataProvider({
  data,
  children,
}: {
  data: DashboardData;
  children: ReactNode;
}) {
  return (
    <DashboardDataContext.Provider value={data}>
      {children}
    </DashboardDataContext.Provider>
  );
}
```

Server component passes data down as props → client provider wraps children. Standard Next.js pattern.

---

### Blocker 3 — Map Layer State Lives in FloodMap ✅ RESOLVED

**Problem**: `showFloodZones` and `showWeatherStations` state lives inside `FloodMap.tsx` (lines 322-323). `MapLayersPanel` in LeftTile can't toggle these without state lift.

**Verified location:**
- `FloodMap.tsx:322` → `const [showFloodZones, setShowFloodZones] = useState(true);`
- `FloodMap.tsx:323` → `const [showWeatherStations, setShowWeatherStations] = useState(true);`
- Passed to `MapControls` on lines 1141-1144

**Fix**: Create a `useMapLayerStore` Zustand store (like existing `useUIStore`):

```tsx
// lib/mapLayerStore.ts
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
  toggleFloodZones: () => set((s) => ({ showFloodZones: !s.showFloodZones })),
  toggleWeatherStations: () => set((s) => ({ showWeatherStations: !s.showWeatherStations })),
}));
```

Then:
- `FloodMap.tsx`: Replace `useState` with `useMapLayerStore()` reads
- `MapLayersPanel.tsx`: Use `useMapLayerStore()` to toggle
- `MapControls.tsx`: Read from store instead of props (or keep props, read from store in FloodMap)

**Scope**: ~30 lines new store + ~20 lines FloodMap refactor. Added to Phase 1.

---

### Blocker 4 — useAirPollutionData Needs Manual lat/lon ✅ RESOLVED

**Problem**: `useAirPollutionData()` returns `fetchAirPollutionData(lat, lon)` — must be called manually. `AqiPanel` needs coordinates.

**Verified**: Hook returns `{ airPollutionData, isLoading, error, fetchAirPollutionData }`.

**Fix**: `AqiPanel` reads location from `useAppStore().selectedLocation` and calls `fetchAirPollutionData` in a `useEffect`:

```tsx
// AqiPanel.tsx
const { selectedLocation } = useAppStore();
const { airPollutionData, isLoading, fetchAirPollutionData } = useAirPollutionData();

useEffect(() => {
  if (selectedLocation?.lat && selectedLocation?.lon) {
    fetchAirPollutionData(selectedLocation.lat, selectedLocation.lon);
  }
}, [selectedLocation?.lat, selectedLocation?.lon]);
```

**Data transformation**: Raw `AirPollutionData` from OpenWeatherMap needs mapping to display format:
- `aqi` (1-5 scale) → level text ("Baik"/"Sedang"/"Tidak Sehat")
- `components.pm2_5` → pollutant display
- Custom recommendation text based on AQI level

`AqiPanel` builds its own display — does NOT reuse `AirQualityCard` which expects a different shape.

---

### Blocker 5 — initialData.stats.mlHealth ✅ ALREADY FIXED

**Claimed**: `dashboard/page.tsx` does not include `mlHealth` in stats.

**Verified**: FALSE — `mlHealth` IS already present. See `dashboard/page.tsx` lines 36-55:
```tsx
let mlHealth = { lstmReady: false, visionReady: false };
// ... HEAD checks to /api/flood-predict and /api/cctv-scan ...
mlHealth = { lstmReady: ..., visionReady: ... };
```
And line 55: `mlHealth,` is included in `initialData.stats`.

**No action needed.** This was fixed in the earlier session.

---

## Non-Blocking Issues — Resolutions

### useLocalStorage SSR Safety
Initialize to `defaultValue` on server. Sync from `localStorage` after mount via `useEffect`:
```tsx
function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) setValue(JSON.parse(stored));
  }, []);
  const setAndPersist = (v: T) => { setValue(v); localStorage.setItem(key, JSON.stringify(v)); };
  return [value, setAndPersist];
}
```

### DragDivider Touch Handling
`DragDivider` only renders inside the CSS Grid desktop layout (hidden via media query at <1024px). Touch handlers still added for tablet users in landscape (1024px+), but no conflict with `MobileSheet`.

### MobileSheet Tab Mapping (explicit)

| Mobile Tab | Source Tile | Content |
|---|---|---|
| **Intel** | Right Tile | Sub-tabs: Alerts, Sensor, Weather, AQI |
| **Commands** | Left Tile | Sub-tabs: AI Tools, Map Layers (with layer toggles), Reports, SMS, Settings |
| **Data** | Bottom Tile | Sub-tabs: Water Levels, Pump Status, Earthquake |
| **Chat** | Left Tile chatbot | Full-height chatbot interface |

Map Layers toggles live in **Commands** tab. No dedicated map overlay.

---

## Proposed Changes

All new code in `components/tiling/`. Existing layout unchanged as rollback.

---

### Phase 1: Foundation (~4-5 hours)

#### [NEW] [SegmentedControl.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/SegmentedControl.tsx) (~80 lines)

Reusable pill-tab switcher with two variants:
- `variant="text"` → horizontal pill tabs with labels (right/bottom tiles)
- `variant="icon"` → icon-only buttons with `title` tooltips (left tile, 200px)
- Active: `bg-blue-600 text-white` pill. Inactive: `text-muted-foreground`
- Sizes: `sm` (32px) and `md` (36px)

#### [NEW] [TilePanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/TilePanel.tsx) (~60 lines)

Generic tile container:
- Fixed header: `<SegmentedControl />`
- Scrollable body: `{children}`
- Fixed footer: "See Full → /route" link (optional)

#### [NEW] [DragDivider.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/DragDivider.tsx) (~100 lines)

Horizontal drag handle:
- 4px grabbable zone, centered 2px line
- Mouse + touch events on `document`
- Clamps 40px–400px, persists to `localStorage`
- Hover visual: brightens to accent blue

#### [NEW] [TilingLayout.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/TilingLayout.tsx) (~150 lines)

CSS Grid root:
- `grid-template-columns: 200px 1fr 280px` (≥1280px)
- `grid-template-columns: 64px 1fr 240px` (1024–1279px)
- `grid-template-columns: 1fr` (<1024px)
- `grid-template-rows: 1fr <bottomHeight>px`
- Gap: 2px with `rgba(0,0,0,0.6)` background
- Reads from `useDashboardData()` context

#### [NEW] [tiling.css](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/tiling.css) (~120 lines)

Grid layout, Hyprland gaps, tile backgrounds, responsive overrides, drag divider styles.

#### [NEW] [DashboardDataContext.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/DashboardDataContext.tsx) (~35 lines)

`'use client'` provider for `initialData`. Used by all tiles to access data.

#### [NEW] [mapLayerStore.ts](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/lib/mapLayerStore.ts) (~20 lines)

Zustand store for `showFloodZones`, `showWeatherStations` + toggles. Replaces `useState` in FloodMap.

#### [NEW] [useLocalStorage.ts](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/hooks/useLocalStorage.ts) (~25 lines)

SSR-safe localStorage persistence hook.

#### [MODIFY] [dashboard/page.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/app/dashboard/page.tsx)

- Read `searchParams.layout` from page props
- Conditionally render `<DashboardDataProvider>` + `<TilingLayout />` when `layout=tiling`
- Else render existing `<CommandCenterView />`

#### [MODIFY] [FloodMap.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/map/FloodMap.tsx)

- Replace `useState` for `showFloodZones` / `showWeatherStations` with `useMapLayerStore()` reads
- ~20 lines changed (lines 322-323, 736, 798, 868, 1141-1144)

---

### Phase 2: Tile Content (~3-4 hours)

#### [NEW] [LeftTile.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/LeftTile.tsx) (~120 lines)

5 icon tabs (Brain, Map, ClipboardList, MessageSquare, Settings).
Bottom: chatbot input bar (48px collapsed, 200px expanded, pushes content up).
At 64px: icon column only, click → 200px overlay.

#### [NEW] [panels/MapLayersPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/MapLayersPanel.tsx) (~80 lines)

Toggle switches reading from `useMapLayerStore()`. "📍 Set Location" button opens `LocationPickerModal`.

#### [NEW] [panels/ReportsPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/ReportsPanel.tsx) (~100 lines)

Compact flood report form. "See Full → /flood-report".

#### [NEW] [panels/SmsPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/SmsPanel.tsx) (~70 lines)

SMS subscription status, recent alerts. "See Full → /sms-subscribe".

#### [NEW] [panels/SettingsPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/SettingsPanel.tsx) (~60 lines)

Language/theme toggles. "See Full → /settings".

#### [NEW] [RightTile.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/RightTile.tsx) (~100 lines)

4 text tabs: Alerts | Sensor | Weather | AQI. Header: `useTimestamp()` freshness.

#### [NEW] [panels/SensorSummaryPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/SensorSummaryPanel.tsx) (~90 lines)

Top 10 water levels by severity + sparklines. Distinct from Bottom's full table.

#### [NEW] [panels/AqiPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/AqiPanel.tsx) (~80 lines)

Reads `useAppStore().selectedLocation` → calls `fetchAirPollutionData(lat, lon)` in `useEffect`. Transforms raw AQI data to display format. Does NOT reuse `AirQualityCard`.

#### [NEW] [BottomTile.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/BottomTile.tsx) (~80 lines)

3 text tabs: Water Levels | Pump Status | Earthquake. Uses `DragDivider` at top.

#### [NEW] [panels/WaterLevelTable.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/WaterLevelTable.tsx) (~120 lines)

Full sortable/searchable table of ALL water level posts. 36px compact rows. Severity row colors.

#### [NEW] [panels/PumpStatusTable.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/PumpStatusTable.tsx) (~100 lines)

Full searchable pump table with status badges.

#### [NEW] [panels/EarthquakePanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/panels/EarthquakePanel.tsx) (~80 lines)

BMKG earthquake data from `useBmkgQuakeData()` (auto-fetches on mount, no extra wiring).

---

### Phase 3: Polish (~2-3 hours)

#### [NEW] [MobileSheet.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/tiling/MobileSheet.tsx) (~80 lines)

Bottom sheet for <768px. 4 tabs: Intel → Right content, Commands → Left content, Data → Bottom content, Chat → chatbot.

#### Polish Tasks
- Hyprland gap fine-tuning (border accents, corner radius)
- "See Full →" routing verification for all panels
- `localStorage` tab state persistence
- Regression testing on `/sensor-data`, `/alerts`, `/current-weather`, etc.
- Test rollback: remove `?layout=tiling` → old layout intact

---

## File Summary

### New Files: 21

| # | File | Est. Lines |
|---|---|---|
| 1 | `components/tiling/SegmentedControl.tsx` | ~80 |
| 2 | `components/tiling/TilePanel.tsx` | ~60 |
| 3 | `components/tiling/DragDivider.tsx` | ~100 |
| 4 | `components/tiling/TilingLayout.tsx` | ~150 |
| 5 | `components/tiling/tiling.css` | ~120 |
| 6 | `components/tiling/DashboardDataContext.tsx` | ~35 |
| 7 | `components/tiling/LeftTile.tsx` | ~120 |
| 8 | `components/tiling/RightTile.tsx` | ~100 |
| 9 | `components/tiling/BottomTile.tsx` | ~80 |
| 10 | `components/tiling/MobileSheet.tsx` | ~80 |
| 11 | `components/tiling/panels/MapLayersPanel.tsx` | ~80 |
| 12 | `components/tiling/panels/ReportsPanel.tsx` | ~100 |
| 13 | `components/tiling/panels/SmsPanel.tsx` | ~70 |
| 14 | `components/tiling/panels/SettingsPanel.tsx` | ~60 |
| 15 | `components/tiling/panels/SensorSummaryPanel.tsx` | ~90 |
| 16 | `components/tiling/panels/AqiPanel.tsx` | ~80 |
| 17 | `components/tiling/panels/WaterLevelTable.tsx` | ~120 |
| 18 | `components/tiling/panels/PumpStatusTable.tsx` | ~100 |
| 19 | `components/tiling/panels/EarthquakePanel.tsx` | ~80 |
| 20 | `hooks/useLocalStorage.ts` | ~25 |
| 21 | `lib/mapLayerStore.ts` | ~20 |

### Modified Files: 2

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Feature flag via `searchParams`, conditional TilingLayout render |
| `components/map/FloodMap.tsx` | Replace `useState` with `useMapLayerStore()` for layer toggles |

### Untouched (rollback intact)

`CommandCenterView.tsx`, `NavRail.tsx`, `PanelSwitcher.tsx`, `SidebarSummary.tsx`, all existing panels, `ClientLayoutWrapper.tsx`.

---

## Verification Plan

### After Each Phase
- `tsc --noEmit` → zero errors

### Phase 1 Verification
1. `localhost:3001/dashboard` → old layout (no flag)
2. `localhost:3001/dashboard?layout=tiling` → grid shell renders with 3 tiles + map
3. Bottom tile drag-resize works
4. Map layers toggle from console / dev tools

### Phase 2 Verification
5. All segmented controls switch tabs
6. Data loads in all panels (alerts, water levels, weather, AQI, earthquake)
7. "See Full →" links navigate correctly
8. Chatbot input visible at left tile bottom

### Phase 3 Verification
9. Mobile (<768px): bottom sheet with 4 tabs
10. 1024–1279px: left collapses to 64px, right narrows to 240px
11. Existing pages (`/sensor-data`, `/alerts`, etc.) unaffected
12. Rollback: remove `?layout=tiling` → old layout perfect
