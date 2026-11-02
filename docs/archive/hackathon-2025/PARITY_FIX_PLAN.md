# PARITY_FIX_PLAN.md — Restoring Feature Parity (flood vs Floodzy)

**Date**: 2026-03-11
**Reference**: `DashboardClientPage.tsx` (926 lines, original Floodzy dashboard — kept as reference)

---

## Priority Order

| Priority | Issues | Theme |
|----------|--------|-------|
| 🔴 STOP-THE-WORLD | #6, #8 | Broken features (fullscreen map, report modal) |
| 🔴 CRITICAL | #1–#5, #7 | Dashboard regression (7 missing widgets) |
| 🟠 MEDIUM | #9–#13 | API wiring + bugs |
| 🟡 LOW | #14–#16 | Minor polish |

---

## 🔴 Issue #6 — Fullscreen Map Broken

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: `isFullscreen={false}` hardcoded (×2, mobile + desktop). `onFullscreenToggle={() => {}}` is empty.
**Fix**:
1. Add `isDashboardMapFullscreen` state to `CommandCenterView`
2. Wire `isFullscreen` and `onFullscreenToggle` to that state
3. Add escape key listener (already exists in `DashboardClientPage.tsx:150–157`)
4. Add `overflow-hidden` to body when fullscreen (from `DashboardClientPage.tsx:172–179`)

**Reference**: `DashboardClientPage.tsx` lines 144–179

---

## 🔴 Issue #8 — ReportFloodModal Never Submits

**Files**: `components/flood-map/ReportFloodModal.tsx`
**Problem**: The modal's submit handler only calls `console.log()` and returns — no actual API call is made to persist the data.
**Fix**:
1. Wire the submit handler to `POST /api/flood-reports` with form data
2. API route already exists (`app/api/flood-reports/route.ts`) with full Zod validation + Supabase insert
3. Show success/error toast after submission

---

## 🔴 Issue #1 — Hero Stat Cards Missing (Scoped)

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: The 4 hero stat cards (Total Regions, Active Alerts, Flood Zones, People at Risk) were removed entirely.

> [!IMPORTANT]
> After the 11-bug fix round, `StatusBar` already shows **Alert Count**, **Flood Zones**, and **People at Risk** via `StatsContext`. Adding all 4 stats again would duplicate 3 of them.

**Fix (revised)**: Add **only `totalRegions`** as a compact stat chip in `StatusBar.tsx` (next to the existing stats). Skip a separate stats strip above the map.

**Alternative**: If we decide the remaining 3 still deserve more visual prominence, add a collapsible stats row below StatusBar that shows all 4 with sparkline trends — but this is optional.

---

## 🔴 Issue #2 — RegionDropdown Missing

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: `RegionDropdown` (location selector) was removed. Users can't pick their location.

> [!WARNING]
> `FloodMap` may have its own controls floating top-left (search) and mid-right (zoom/layers). Checked: no `MapSearchControl` or `MapActionsControl` exists in the `components/map/` directory — the dashboard FloodMap instance is control-free. **Top-left is safe.**

**Fix**: Add `RegionDropdown` as a floating overlay at **top-left of the dashboard map** (`absolute top-3 left-3 z-[1000]`). Port `handleRegionSelect` logic from `DashboardClientPage.tsx:222–256`.

**Reference**: `DashboardClientPage.tsx` lines 222–256, 594–612

---

## 🔴 Issue #3 — DashboardStats Card Missing

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: `DashboardStats` component (pump system, recent activity) exists but was never imported.
**Fix**: This is partially covered by the existing `DataPanel` in the sidebar (which shows water levels + pump status). **Recommendation**: Skip — the sidebar `DataPanel` already provides this data. If more detail is needed, add a "Details" button in DataPanel that opens InfrastructureStatusCard (see Issue #5).

---

## 🔴 Issue #4 — Weather + AQ Cards Missing

**Files**: `components/layout/CommandCenterView.tsx`, `components/panels/PanelSwitcher.tsx`, **`components/layout/NavRail.tsx`**
**Problem**: `/api/dashboard` is never called — `WeatherSummaryCard` and `AirQualityCard` are dead.

> [!NOTE]
> ✅ **VERIFIED**: `app/api/dashboard/route.ts` accepts `GET ?lat=&lon=` and returns `{ weatherSummary, airQuality }` — the exact shape `WeatherSummaryCard` and `AirQualityCard` expect. The Floodzy reference calls `/api/dashboard-widgets` (different name) but flood's `/api/dashboard` is the correct equivalent. Use `GET /api/dashboard?lat={lat}&lon={lon}`.

**Fix**:
1. Add a `fetchDashboardWidgets` call in `CommandCenterView` when `selectedLocation` changes (port from `DashboardClientPage.tsx:181–220`)
2. Create a new `"weather"` panel in the sidebar that shows `WeatherSummaryCard` + `AirQualityCard`
3. The `PanelContext` already supports `PanelId = 'weather'` — just need a `WeatherPanel` component
4. **Add a nav item in `NavRail.tsx`** to trigger `setPanel('weather')`. Options:
   - Replace the existing `Command` item (id='command') with a `Weather` item, OR
   - Add `Weather` to the `overflowItems` array under "More", OR
   - Insert it as a 5th primary nav item (push `More` out or replace `AI Tools`)
   - **Recommended**: Add as primary nav item between `Data` and `AI Tools` using the `CloudSun` icon

**Reference**: `DashboardClientPage.tsx` lines 181–220

---

## 🔴 Issue #5 — InfrastructureStatusCard Missing

**Files**: `components/panels/PanelSwitcher.tsx` (DataPanel section)
**Problem**: `InfrastructureStatusCard` (full water level table + pump status with detail modal) exists as a component but isn't rendered.

> [!WARNING]
> **Do NOT add below the map.** The command center shell is `height: 100vh; overflow: hidden`. Adding scrollable content below `WaterLevelsStrip` breaks the "map always visible" design. 

**Fix (revised)**: Extend the existing `DataPanel` (sidebar, `PanelId = 'data'`) to include `InfrastructureStatusCard` content at the bottom. Either:
- Append it below the existing water level list in DataPanel, with a divider, OR
- Add a toggle/tab within DataPanel ("Water Levels" | "Infrastructure") to switch views

**Reference**: `DashboardClientPage.tsx` lines 783–787

---

## 🔴 Issue #7 — Mobile Map Drawer Missing

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: Floodzy had a Drawer component for full-screen map on mobile; flood uses a static 40vh inline map.
**Fix**:
1. Add an "Expand Map" button overlay on the mobile map
2. Use the existing `Drawer` component (already imported in `DashboardClientPage.tsx`)
3. Full-height drawer contains a `FloodMap` with `isFullscreen={true}`

**Reference**: `DashboardClientPage.tsx` lines 628–652, Drawer usage

---

## 🟠 Issue #9 — Statistics Incidents API

**Files**: `app/statistics/page.tsx` → calls `/api/statistics/incidents`
**Problem**: Need to verify response shape matches what the frontend expects.
**Status**: ✅ **VERIFIED** — route exists at `app/api/statistics/incidents/route.ts`, queries `historical_incidents` table, returns `data ?? []`. Frontend at line 75 already calls the correct URL. **No fix needed** — just confirm Supabase table exists.

---

## 🟠 Issue #10 — Sensor Data Report Chart API

**Files**: `components/sensor-data/FloodReportChart.tsx:33` → calls `/api/flood-reports`
**Problem**: Verify it returns 24h time-series data shape.
**Status**: ✅ **VERIFIED** — route at `app/api/flood-reports/route.ts` returns all reports ordered by `created_at desc`. FloodReportChart uses this and groups into a 24h chart. **No fix needed**.

---

## 🟠 Issue #11 — Flood Report ML Prediction API

**Files**: `app/flood-report/page.tsx:202` → calls `/api/predict`
**Problem**: Verify `/api/predict` accepts same request body as Floodzy's `/api/predict-flood`.
**Status**: ✅ **VERIFIED** — `/api/predict/route.ts` is a generic proxy that forwards any JSON body to `ML_API_URL/predict`. The flood-report page sends `{ latitude, longitude, water_level, curah_hujan_24h, ... }` which the ML service accepts. The route adds `mode_used` and `input_data` to the response but preserves all original fields (`probability`, `risk_label`). **No fix needed** — shapes are compatible.

---

## 🟠 Issue #12 — Chatbot Missing Geolocation Flow

**Files**: `components/layout/CommandCenterView.tsx` (AIChatbot function)
**Problem**: The simplified AIChatbot is missing the `REQUEST_LOCATION` action handler that asks for user's location.
**Fix**: Port the `REQUEST_LOCATION` branch from `DashboardClientPage.tsx:386–456` into AIChatbot's `sendMessage` handler. Adds:
1. Check for `data.action === 'REQUEST_LOCATION'`
2. Call `navigator.geolocation.getCurrentPosition()`
3. Second API call with location data

**Reference**: `DashboardClientPage.tsx` lines 358–483

---

## 🟠 Issue #13 — Google Maps URL Malformed

**Files**: `app/evacuation/page.tsx:102`
**Problem**: URL is `http://googleusercontent.com/maps.google.com/2{lat},${lon}` — completely broken (wrong domain, missing `$` on lat, wrong path).
**Fix**: Single line change:
```diff
-window.open(`http://googleusercontent.com/maps.google.com/2{lat},${lon}`, '_blank');
+window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
```

---

## 🟡 Issue #14 — Alert Feed Capped at 15

**Files**: `components/layout/CommandCenterView.tsx:74`
**Problem**: `alerts.slice(0, 15)` — Floodzy showed all.
**Fix**: Either remove the cap or add a "View all → /alerts" link at the bottom. Recommended: keep limit at 20 + add link.

---

## 🟡 Issue #15 — Statistics Analysis Endpoint

**Files**: `app/statistics/components/StatistikOverview.tsx:212,244`, `components/dashboard/AnalysisSection.tsx:75` → call `POST /api/analysis`
**Problem**: Floodzy called `/api/gemini-analysis`. Need to verify `/api/analysis` returns same shape.
**Status**: ✅ **VERIFIED** — `/api/analysis/route.ts` accepts `POST { prompt }` and returns `{ response: text }` via Gemini `gemini-2.5-flash`. Both `StatistikOverview.tsx` and `AnalysisSection.tsx` send `{ prompt }` and read `data.response`. **Shapes match. No fix needed.**

---

## 🟡 Issue #16 — Dashboard Widget Fetch

**Files**: `components/layout/CommandCenterView.tsx`
**Problem**: When `selectedLocation` changes, should fire `GET /api/dashboard?lat=&lon=` to populate weather + AQ cards.
**Status**: Covered by Issue #4 above. **No separate fix needed**.

---

## Implementation Order

```
Phase 1 — Quick Wins (can be done independently, ~30 min each)
├── #13  Google Maps URL fix (1 line)
├── #8   ReportFloodModal submit wiring
├── #6   Fullscreen map state wiring
└── #14  Alert feed cap + "View all" link

Phase 2 — Dashboard Restoration (~2-3 hours total)
├── #1   Add totalRegions chip to StatusBar
├── #2   RegionDropdown as map overlay (top-left, verified safe)
├── #4   Weather panel + NavRail item + /api/dashboard fetch
├── #5   Extend DataPanel with InfrastructureStatusCard
└── #7   Mobile map drawer

Phase 3 — Chatbot + Polish (~30 min)
└── #12  Chatbot geolocation flow

Issues confirmed resolved (no fix needed):
├── #9   /api/statistics/incidents ✅ (route exists, correct shape)
├── #10  /api/flood-reports ✅ (route exists, correct shape)
├── #11  /api/predict ✅ (generic proxy, compatible shapes)
├── #15  /api/analysis ✅ (POST {prompt} → {response}, Gemini-backed)
└── #16  Covered by #4
```

---

## Files That Will Be Modified

| File | Issues |
|------|--------|
| `components/layout/CommandCenterView.tsx` | #2, #6, #7, #12, #14 |
| `components/layout/NavRail.tsx` | #4 (add Weather nav item) |
| `components/layout/StatusBar.tsx` | #1 (add totalRegions chip) |
| `components/flood-map/ReportFloodModal.tsx` | #8 |
| `app/evacuation/page.tsx` | #13 |
| `components/panels/PanelSwitcher.tsx` | #4, #5 (add WeatherPanel + extend DataPanel) |
| `components/panels/PanelContext.tsx` | (no change — 'weather' panel already supported) |

## New Files

| File | Purpose |
|------|---------|
| `components/panels/WeatherPanel.tsx` | Weather + AQ sidebar panel (#4) |

## Reference File (DO NOT DELETE)

`components/layout/DashboardClientPage.tsx` — The original 926-line Floodzy dashboard. Contains all the logic and components that need to be ported back.
