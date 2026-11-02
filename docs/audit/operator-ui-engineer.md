# Audit: operator UI (Phase A, audit only)

Author: `operator-ui-engineer` subagent. Date: 2026-11-02. Mode: read-only. No application code was changed, no dev server was run, nothing was installed. Line numbers are from the working tree on `main` at commit `49a23e3`.

Scope: `app/` pages, `components/` (131 files), `hooks/`, `lib/` (UI-facing parts), `src/` (i18n and context), `public/` (static public pages and the PWA). API routes are listed only as the data sources that UI consumers depend on. Their internals (D1 to D4, Twilio, the chatbot tools) belong to other agents.

Method: file listing; grep for `Math.random`, `*_MOCK`, inline mock arrays, `fetch(`, external hosts and `useLanguage`; manual reading of every page and of the main map, dashboard, tiling and panel components; an importer search to find dead files. "Unused" means grep found no importer. A dynamic import that uses a computed string would not be caught, but none were seen.

---

## 1. Summary

### Counts (rows UI-001 to UI-062 in section 8)
| Decision | Count |
|---|---|
| KEEP | 5 |
| REFACTOR | 13 |
| REBUILD | 4 |
| NEW | 11 |
| DELETE | 26 |
| PARK | 3 |
| **Total** | **62** |

### Top findings
1. **D5 confirmed.** `/dashboard`, the default landing route (`app/page.tsx` redirects there), renders 100 random water-level posts and 100 random pumps from `lib/mock-data.ts`, plus 8 hardcoded national flood alerts. The UI labels this "LIVE" and "Real-time Data".
2. **D6 confirmed, and worse than described.** `app/api/evacuation/route.ts:21-30` randomizes shelter status, utilities **and `verified_by`**, so the output can show "BPBD DKI Jakarta" or "BNPB" as the verifier of fabricated data. Evacuation pins are on by default (`lib/mapLayerStore.ts:23`), and the default bottom tab is evacuation (`components/tiling/BottomTile.tsx:27`).
3. **D7 confirmed.** `FLOOD_ZONES_MOCK` (`lib/constants.ts:351-384`) defines two axis-aligned rectangles (Kelapa Gading, Cempaka Putih). `components/map/FloodMap.tsx:406` loads them and lines 855-913 render them. The layer is on by default (`showFloodZones: true`).
4. **14 more fake-data sources** (17 in total) reach the UI (section 3). They include fabricated citizen reports with **random Indonesian phone numbers** (`app/sensor-data/page.tsx:62-77`), a forecast copied to 3 other stations (`components/flood-map/PredictionLayer.tsx:84-91`), random sparkline history (`components/panels/DataPanel.tsx:41`), and hardcoded CCTV flood probabilities (`lib/constants.ts:912-961`).
5. **No page requires login.** There is no `middleware.ts` or `proxy.ts`. The only auth call is in `app/api/preferences/route.ts:11,46`. The app is publicly indexed: `app/sitemap.ts`, a Google verification meta tag (`app/layout.tsx:38-40`) and public marketing HTML in `public/`.
6. **Every public-facing feature named in the plan is present:** shelters, OSRM routing, citizen SMS subscription, the 34-province selector, OpenWeatherMap/RainViewer/AQI layers and the Gemini chatbot. There are also citizen flood reporting, education pages, and "Peringatan" (warning) components.
7. **None of the 6 target pages exists.** The map shell, tiling layout, mobile sheet, UI kit, charts and i18n context can be reused.
8. **No provenance or "data terakhir" anywhere.** `useTimestamp` records the time of the fetch, not the time of the observation. `FloodRiskForecast` stamps `now()` as "last updated" over mock data. Nothing visibly says DEMO or SIMULASI, apart from the CCTV page title and some Settings toasts.

### Guardrail violations found in the UI layer (all must become W1 backlog items)
- **#1 (no public warnings):** the citizen SMS subscribe page, the public alerts page, "Peringatan Bencana" cards, the education/landing pages and the public sitemap.
- **#3 (personal data):** the citizen flood report form stores `reporter_name` and `reporter_contact` and makes photos public. The sensor-data mock fabricates phone numbers. OSRM routing sends user geolocation to a public demo server.
- **#5 (fake data):** the 17 sources (F1 to F17) in section 3.
- **#7 (provenance):** no source or timestamp per value. Fake "LIVE" labels.
- **#10 (secrets):** the OpenWeatherMap key is read from `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` (`lib/geocodingService.ts:4`), so it ships in the browser bundle, and `FloodMap` puts `appid` in tile URLs (`components/map/FloodMap.tsx:754`). No secret values were printed during this audit.
- **#15 (Bahasa Indonesia first):** the default language is `id`, but SSR renders `<html lang="en">`, nav labels are hardcoded in English, and about 80 of 158 .tsx files have no i18n.

---

## 2. Page and route inventory (`app/`)

There are 24 `page.tsx` routes, plus `layout.tsx`, `loading.tsx`, `not-found.tsx`, `global-error.tsx` and `sitemap.ts`. None of them require login.

| Route | File | Data source(s) | Fake data? | Public-facing feature? | Row |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | redirects to `/dashboard` | n/a | n/a | UI-001 |
| `/dashboard` | `app/dashboard/page.tsx` | `lib/mock-data.ts` (random), `FLOOD_MOCK_ALERTS`, BMKG `autogempa.json` (earthquake), HEAD checks on `/api/flood-predict` (route does not exist) and `/api/cctv-scan` | **YES (D5)** | Evac, SMS tab, chatbot, weather/AQI, regions | UI-001 |
| `/dashboard?layout=classic` | `components/layout/CommandCenterView.tsx` | same, plus Overpass, `WEATHER_STATIONS_GLOBAL_MOCK`, `/api/chatbot`, `/api/weather` | YES | yes | UI-034 |
| `/alerts` | `app/alerts/page.tsx` | inline `allMockAlerts` (l.43) and `NEWS_ITEMS` (l.54-60) | YES | Public alert list | UI-017 |
| `/sensor-data` | `app/sensor-data/page.tsx` | Supabase `laporan_banjir`; if empty, **50 random reports** (l.31-77); `StatisticsDashboard` (random); `SensorSimulatorChart` from `/api/sensor-simulator` (CSV replay, random fallback) | YES | Citizen reports | UI-018 |
| `/statistics` | `app/statistics/page.tsx` plus `components/*` | Supabase `historical_incidents` via `/api/statistics/incidents`; hardcoded pie (`StatistikOverview.tsx:100-106`); Gemini `/api/analysis`, `/api/chatbot` | partly | National disaster statistics | UI-020 |
| `/evacuation` | `app/evacuation/page.tsx` | `/api/evacuation` (Supabase plus random status, D6) | **YES (D6)** | Shelters | UI-012 |
| `/flood-map` | `app/flood-map/page.tsx`, `components/flood-map/PetaBanjirClient.tsx` | inline `mockFloodReports` (l.70-127), `mockEvacuationPoints` (l.129); `/api/flood-reports` (Supabase); `/api/predict`; BMKG radar tile URL (`PetaBanjirClient.tsx:313`) | YES | Public map, routing | UI-022 |
| `/flood-predict` | `app/flood-predict/page.tsx` | `/api/predict`, `/api/scenarios`, `/api/ml-health` (FastAPI, D2 to D4) | depends on D2 to D4 | "AI forecast" for public | UI-021 |
| `/flood-report` | `app/flood-report/page.tsx` | Browser Supabase client: anon **insert** into `laporan_banjir`, public storage bucket `laporan-banjir`; `/api/predict` | n/a | **Citizen report with name and contact** | UI-023 |
| `/sms-subscribe` | `app/sms-subscribe/page.tsx` | `POST /api/sms-subscribe` (Supabase `sms_subscribers`) | n/a | **Citizen SMS** | UI-014 |
| `/cctv-simulation` | `app/cctv-simulation/page.tsx` | `CCTV_CHANNELS` (hardcoded `is_flooded` and `flood_probability`), local MP4s, `/api/verify-visual` | YES (title says "Simulasi CCTV") | CCTV | UI-024 |
| `/visual-verify` | `app/visual-verify/page.tsx` | `/api/verify-visual` (FastAPI YOLO) | n/a | photo upload | UI-025 |
| `/weather-forecast` | `app/weather-forecast/page.tsx` (996 lines) | `/api/weather` (OWM), `components/weather/WeatherMap.tsx` (OWM tiles) | no | Generic weather | UI-026 |
| `/current-weather` | `app/current-weather/page.tsx`, `components/weather-shortcut.tsx` | `/api/dashboard` (an OWM proxy, despite the name) | no | Generic weather | UI-026 |
| `/settings` | `app/settings/page.tsx` | `RegionDropdown` (provinces), `/api/preferences` (Supabase auth), toasts marked "(Simulasi)" | partly | Region and notification preferences | UI-030 |
| `/education` plus 4 sub-pages | `app/education/**` | static | no | Public education/SEO | UI-027 |
| `/contact` | `app/contact/page.tsx` | static form | no | Marketing | UI-029 |
| `/privacy` | `app/privacy/page.tsx` | static; "Terakhir diperbarui" = `new Date()` (l.11) | fake date | Public privacy notice | UI-029 |
| `/data-source` | `app/data-source/page.tsx` | static | no | Marketing | UI-028 |
| `public/*.html` | `landing.html`, `about.html`, `contact.html`, `privacy.html`, `data-source.html`, `404.html`, `google39dcc95b5ae64a3b.html` | static | no | Public marketing; NavRail links `/about.html` | UI-028 |
| sitemap | `app/sitemap.ts` | static | no | Public indexing | UI-028 |
| `/test` | `app/test/route.ts`; also `app/api/test/route.ts`, `app/api/test.css` | test stubs | n/a | n/a | UI-035 |

---

## 3. Fake, random and hardcoded sources with their import chains (Guardrail 5)

| # | Rendered where | Chain down to the literal or `Math.random()` | UI label |
|---|---|---|---|
| F1 (**D5**) | `/dashboard`: water-level list, pumps, flood-zone count, region count, people at risk | `app/page.tsx:4` redirects to `app/dashboard/page.tsx:9,30-31` `generateMockWaterLevels(100)` / `generateMockPumpStatus(100)`, which call `lib/mock-data.ts:15-19` `getRandomElement` / `getRandomFloat` and so `Math.random()` (also l.42 and l.63 for timestamps). The results flow through `DashboardDataProvider` (`components/tiling/DashboardDataContext.tsx`) into `TilingLayout`, `LeftTile`, `RightTile`, `BottomTile` ('sensor' and 'status' tabs, l.395-490), `FloodRiskForecast`, `MobileSheet`, and in classic mode `CommandCenterView` into `DataPanel` / `SidebarSummary`. `floodZones` and `peopleAtRisk` come from `dashboard/page.tsx:40-43`. `peopleAtRisk` is `alert.estimatedPopulation \|\| 2500` summed over the mock alerts. | "LIVE" (`FloodRiskForecast.tsx:147`), "Real-time Data" (`BottomTile.tsx:472`) |
| F2 | Dashboard alert ticker, alerts tabs | `app/dashboard/page.tsx:33-34` imports `lib/constants.ts:228-349` `FLOOD_MOCK_ALERTS`: 8 hardcoded national alerts (Sumatera Barat, Demak, Mahakam, Aceh, and others) with timestamps relative to `Date.now()`. Rendered at `components/tiling/TilingLayout.tsx:47-49` and in `RightTile.tsx:209`, `BottomTile.tsx:442`. | "active alerts" |
| F3 (**D6**) | Evacuation pins, `/evacuation`, BottomTile evac tab | `app/api/evacuation/route.ts:21-30`: `operational_status`, `essential_services.*` and **`verified_by`** are picked with `Math.random()` per request. Consumers: `components/map/FloodMap.tsx:356`, `components/tiling/BottomTile.tsx:42`, `app/evacuation/page.tsx:84`. | "Live" (`BottomTile.tsx:327`) |
| F4 (**D7**) | Flood-zone polygons on the main map | `lib/constants.ts:351-384` `FLOOD_ZONES_MOCK` (two rectangles, `lastUpdate: new Date()`) is used at `components/map/FloodMap.tsx:65,406` and rendered at l.855-913 when `showFloodZones` is true (default `true`, `lib/mapLayerStore.ts:19`). The commented-out PetaBencana and BPBD layers are at `FloodMap.tsx:787-850`. | none |
| F5 | Sparklines in DataPanel (classic) | `components/panels/DataPanel.tsx:33-44`: a 6-point history fabricated as `level + delta*(5-i) + Math.random()*3-1.5` | none |
| F6 | `/sensor-data` reports list and map | `app/sensor-data/page.tsx:31-77`: when Supabase is empty, 50 reports are generated with random location jitter, water level, reporter name, and **`reporter_contact: 08` + 10 random digits** (l.74) | none |
| F7 | `/sensor-data` statistics charts | `components/dashboard/StatisticsDashboard.tsx:30-45` `generateRandomData` (6 regions, `Math.random()`) | none |
| F8 | `/sensor-data` sensor chart | `components/sensor-data/SensorSimulatorChart.tsx:32` polls `/api/sensor-simulator` every 3 s. That route replays `ml-service/data/DATASET_FINAL_TRAINING.csv` by wall-clock (`app/api/sensor-simulator/route.ts:23`) and falls back to `Math.sin + Math.random()` (l.48-58). Same class of defect as D1. | none |
| F9 | Flood-risk widget | `components/tiling/FloodRiskForecast.tsx:96-103` uses hardcoded stations when posts are empty. Otherwise risk = `0.5*status + 0.3*"rainfallProxy" + 0.2*CCTV prob`, where the CCTV probability comes from hardcoded `CCTV_CHANNELS` (`lib/constants.ts:912-961`). "lastUpdated" is the current clock (l.132-135). | "LIVE" |
| F10 | CCTV page and BottomTile CCTV tab | `lib/constants.ts:912-961` `CCTV_CHANNELS` (`is_flooded: true`, `flood_probability: 0.95`, ...), used by `app/cctv-simulation/page.tsx:7`, `BottomTile.tsx:12`, `FloodRiskForecast.tsx:5` | page title "Simulasi CCTV" only |
| F11 | AQI map layer | `components/map/MockAQILayer.tsx:17-60` `MOCK_DATA`: 34 cities with fixed AQI values, used by `FloodMap.tsx:102,727` when `showAqi` is true | none |
| F12 | Weather-station markers (classic) | `lib/constants.ts:170-224` `WEATHER_STATIONS_GLOBAL_MOCK` (fixed temperature and humidity, `timestamp: new Date()`), used at `CommandCenterView.tsx:483,531,594` and `DashboardClientPage.tsx` | none |
| F13 | Forecast circles on `/flood-map` | `components/flood-map/PredictionLayer.tsx:21-26,84-91`: one `/api/predict` result is drawn on 4 stations. Istiqlal, Karet and Marina get Manggarai's risk at 0.7× radius. | "Affected zone" |
| F14 | `/flood-map` reports and evacuation points | `app/flood-map/page.tsx:70-127` `mockFloodReports` (placehold.co images, `isVerified: true`), l.129 `mockEvacuationPoints` | "Verified" badge |
| F15 | `/alerts` and BottomTile 'berita' tab | `app/alerts/page.tsx:43-60` and `components/tiling/BottomTile.tsx:644-720`: hardcoded alerts and fabricated news headlines attributed to KOMPAS, DETIK, CNN ID, TEMPO, ANTARA and REPUBLIKA, with relative timestamps | "articles" |
| F16 | LeftTile SMS tab | `components/tiling/LeftTile.tsx:109-118`: hardcoded "Status: Active / Subscribed to flood alerts" | none |
| F17 | `/statistics` overview | `app/statistics/components/StatistikOverview.tsx:100-106` hardcoded pie (Banjir 35, Gempa 25, ...); the comment at l.85 admits "data mock untuk demonstrasi" | none |

Not a data issue: `Math.random()` used to make IDs or keys only (`lib/utils.ts:104,145`, `FloodMap.tsx:408`, `src/lib/rateLimiter.ts:22`). Delete `lib/utils.ts:145` (random colour) with its callers.

Other unused mock constants that are still exported (delete with F2): `WEATHER_MOCK_DATA` (l.154), `DASHBOARD_STATS_MOCK` (l.386, imported only by the dead `DashboardClientPage`), `LAPORAN_BANJIR_MOCK` (l.395), `EVACUATION_LOCATIONS_MOCK` (l.422-910, contains contact phone numbers), and `generateMockAlerts` (`lib/mock-data.ts:69`).

---

## 4. Public-facing features (target: delete or park, per `01_PRODUCT_BRIEF.md` non-goals and `10_GUARDRAILS.md` #1)

| Feature | Where | Notes |
|---|---|---|
| Shelters (35 in Supabase) | `app/evacuation/page.tsx`; `components/tiling/BottomTile.tsx:279-394` (default tab); `components/map/FloodMap.tsx:349-400,920-960` (pins default ON); `app/api/evacuation/route.ts` | Random status (D6). The UI says "Live". |
| OSRM routing | `components/map/EvacuationRouting.tsx`, `components/flood-map/EvacuationRouting.tsx` (duplicates), `leaflet-routing-machine` dep, `types/leaflet-routing-machine.d.ts` | Uses the public OSRM demo backend (comment at l.15). Sends the user's GPS position (`navigator.geolocation`, `FloodMap.tsx:362-385`) to a third party. |
| Citizen SMS subscribe UI | `app/sms-subscribe/page.tsx`; NavRail item (`components/layout/NavRail.tsx:48`); LeftTile 'sms' tab | Collects phone and name into `sms_subscribers`. Guardrails #1 and #3. |
| 34-province selector | `components/region-selector/RegionDropdown.tsx` (794 lines, province, regency, district), `components/tiling/RegionSelector.tsx` (352, plus Nominatim search l.132), `hooks/useRegionData.ts` → `lib/api.client.ts:23` → `/api/regions` (Supabase admin); `components/modals/LocationPickerModal.tsx`; `app/settings/page.tsx`; `INDONESIA_REGIONS` | Replace with a polder or kelurahan selector. |
| Generic weather layers | OWM tiles (`FloodMap.tsx:730-758`, `/api/weather/tiles/[...tile]`, `components/weather/WeatherMap.tsx:214-230`, `WeatherMapIframe.tsx:299`); `/weather-forecast`, `/current-weather`, `WeatherPanel`, RightTile 'Cuaca' tab, `useWeatherData` → `/api/weather`; `/api/dashboard` (OWM) | Key exposed client-side (G10). |
| AQI layers | `MockAQILayer` (fake); `components/map/WeatherInsightMap.tsx:71` (aqicn tiles), `/api/air-quality` (WAQI, mock fallback), `useAirPollutionData` (OWM direct from the browser), `AQIPopup`, `AirQualityCard` | Out of scope. |
| RainViewer radar | `components/map/RadarLayer.tsx`, `TimelineScrubber.tsx`, fetches at `FloodMap.tsx:422` and `WeatherInsightMap.tsx:242` | Rain context is in scope. RainViewer is not the plan's source (BMKG S5, Open-Meteo fallback). PARK. |
| Overpass "flood-prone" overlay | `hooks/useDisasterData.ts` → `lib/api.client.ts:39-97` (overpass-api.de), classic view only | OSM tags are not authoritative. |
| BMKG earthquake | `app/dashboard/page.tsx:23`, `BottomTile` 'earthquake' tab | Not flood. Delete. |
| Chatbot (Gemini) | `components/tiling/RightTile.tsx:100-200,541+` ('AI Chat' tab), `CommandCenterView.tsx:305`, `app/statistics/components/GeminiChatSection.tsx` → `/api/chatbot` (8 tools, `gemini-2.5-flash`) | Tools read the D1 replay and other public APIs. PARK as a future operator assistant (CITYA-style). |
| Citizen flood report | `app/flood-report/page.tsx` (anon insert), `components/flood-map/ReportFloodModal.tsx`, `ReportFloodControl.tsx` (unused), `components/sensor-data/ReportEmergencyModal.tsx` (unused) | Name, contact and public photo URL (G3). |
| Public warnings wording | `components/flood/PeringatanBencanaCard.tsx`, `components/flood/FloodAlert.tsx` (unused), `components/contexts/AlertCountContext.tsx` (polls `/api/alerts` every 30 s) | "Peringatan" implies Noah issues warnings (G1). |
| Public marketing and SEO | `public/landing.html`, `about.html`, `data-source.html`, `contact.html`, `privacy.html`; `app/education/**`; `app/contact`; `app/sitemap.ts`; `app/layout.tsx:27-41` (metadata "SMS alerts for vulnerable communities", Google verification) | Trial is not public (08). |
| PWA | `next.config.js:3-6` (`@ducanh2912/next-pwa`), committed `public/sw.js`, `workbox-*.js` | Offline cache can show stale numbers as current (G7). |

---

## 5. Components and hooks inventory (data source per item)

### Map stack
| Component | Lines | Data source | Reusable? |
|---|---|---|---|
| `components/map/FloodMap.tsx` | 1339 | Basemaps: CartoDB dark, OSM, Esri World Imagery and Topo (l.317-333); RainViewer; OWM; `/api/evacuation`; `FLOOD_ZONES_MOCK`; `MockAQILayer`; OWM geocoding (`lib/geocodingService.ts`); props for Overpass and weather stations | **Partly.** Extract the MapContainer shell, basemap switcher, fullscreen and fit/fly logic. Drop about 70% of it. |
| `components/map/RadarLayer.tsx` | 81 | Props (frames, host) | Yes (generic animated tile layer, can be pointed at BMKG frames) |
| `components/map/TimelineScrubber.tsx` | 212 | Props | Yes (time slider for nowcast lead 60/120/180 min) |
| `components/map/MapControls.tsx` | 258 | Props | Yes after relabeling |
| `components/map/MapLegend.tsx` | 131 | Static legend | Refactor to probability classes |
| `components/map/MapPicker.tsx` | 190 | OSM tiles | Yes (Admin: place station or pump) |
| `components/map/WeatherInsightMap.tsx` | 453 | RainViewer, aqicn, `/api/air-quality` | No |
| `components/map/MockAQILayer.tsx`, `AQIPopup.tsx`, `WeatherLegend.tsx` | 287/76/? | Hardcoded | No |
| `components/map/EvacuationRouting.tsx`, `components/flood-map/EvacuationRouting.tsx` | 81/? | OSRM demo | No |
| `components/flood-map/PetaBanjirClient.tsx` | 419 | `/api/flood-reports`, OSM, BMKG radar tile | No (salvage the popup pattern) |
| `components/flood-map/MapInvalidator.tsx`, `MapEventsHandler.tsx`, `lib/leaflet-fix.ts` | small | n/a | **Yes** (Leaflet resize and double-init fixes) |
| `components/flood-map/MapSearchControl.tsx`, `MapActionsControl.tsx`, `MapFilterControl.tsx` (unused) | 105/322/342 | geocoding | Filter UI pattern only |
| `components/flood-map/FloodReportCard.tsx`, `FloodReportPopup.tsx` | 102/227 | Props | Pattern for BPBD report popups |
| `components/flood-map/PredictionLayer.tsx` | 116 | `/api/predict` copied to 4 points | No |
| `components/MapDisplay.tsx` | ? | unused | No |
| `lib/mapLayerStore.ts` | 36 | zustand | Refactor (polder, nowcast, reports and stations layers) |
| `lib/locationStore.ts`, `lib/store.ts` | | zustand (region selection, preferences) | Refactor or replace |
| `lib/mapUtils.ts` | | haversine | Keep |

### Layout and shell
| Component | Data source | Reusable? |
|---|---|---|
| `components/layout/ClientLayoutWrapper.tsx` | none; route lists hardcoded (l.44-49) | Refactor (add auth gate and role-based chrome) |
| `components/layout/NavRail.tsx` | static items (English labels l.35-51) | Refactor into the 6 target items |
| `components/layout/StatusBar.tsx` | clock `id-ID` (l.58), ML/LSTM status (l.143-150) | Refactor into the connector health strip |
| `components/layout/PageShell.tsx`, `CommandMenu.tsx`, `SearchTrigger.tsx`, `HtmlLangSync.tsx` | none | Keep |
| `components/layout/CommandCenterView.tsx` (672) | weather, Overpass, chatbot, mocks | Delete |
| `DashboardClientPage.tsx` (925), `Header.tsx`, `Sidebar.tsx`, `Footer.tsx`, `SplashScreen.tsx` | unused | Delete |
| `components/tiling/*` (TilingLayout, TilePanel, DragDivider, SegmentedControl, MobileSheet, TilingModeContext, TilingStatusBar) | `useDashboardData`, `useMediaQuery`, `useLocalStorage` | **Yes**: the Ringkasan frame (map plus side and bottom tiles, mobile sheet) |
| `components/tiling/LeftTile.tsx`, `RightTile.tsx`, `BottomTile.tsx`, `FloodRiskForecast.tsx`, `RegionSelector.tsx` | mocks, OWM, chatbot, evac, CCTV | Rewrite contents, keep the tab scaffolding |
| `components/tiling/DashboardDataContext.tsx` | server props | Refactor (typed, from `/api/v1/nowcast/current`) |
| `components/panels/*` (PanelContext, PanelSwitcher, DataPanel, WeatherPanel, AIToolsPanel, SidebarSummary) | mocks, `/api/dashboard`, ML HEAD | DataPanel layout is reusable for a station list. The rest are deleted. |

### Dashboard cards, charts, sensor data
| Component | Data source | Reusable? |
|---|---|---|
| `components/dashboard/InfrastructureStatusCard.tsx` (466) | props `WaterLevelPost`/`PumpData`; shows "Update Terakhir" (l.142), defaulting to `new Date()` when missing (l.82,85) | Pattern for pump/station table; remove the timestamp default |
| `components/dashboard/DashboardStats.tsx` (335) | props | Stat-tile pattern |
| `components/dashboard/StatisticsDashboard.tsx` | random | Delete |
| `components/dashboard/MLStatusCard.tsx` | `/api/ml-health` | Delete (or turn into model-version badge) |
| `components/dashboard/AirQualityCard.tsx`, `WeatherSummaryCard.tsx`, `LocationPromptCard.tsx`, `AnalysisSection.tsx` (unused) | OWM, Gemini | Delete |
| `components/sensor-data/FloodReportChart.tsx` | `/api/flood-reports` hourly, recharts | Chart pattern for reports per hour (Polder detail) |
| `components/sensor-data/SensorSimulatorChart.tsx` | `/api/sensor-simulator` (replay) | Chart pattern for the level series; the data source must go |
| `components/sensor-data/DataSensorClientContent.tsx` (421) | props plus OWM | Delete |
| `HistoricalRainfallChart.tsx`, `FloodReportList.tsx`, `CurrentWeatherModal.tsx`, `ReportEmergencyModal.tsx` | unused | Delete |
| `app/statistics/components/StatistikHistorical.tsx` (recharts) | Supabase incidents | Chart pattern for Skor trends |
| `components/ui/*` (37 shadcn/radix files incl. `Sparkline.tsx`) | none | **Keep** |
| `components/weather/*` (11 files; 7 unused) | OWM | Delete |

### Hooks
| Hook | Source | Used? | Decision |
|---|---|---|---|
| `useMediaQuery`, `useLocalStorage`, `useDebounce`, `useTheme`, `use-toast` | browser | yes | Keep |
| `useTimestamp` | client clock at fetch time; English strings ("Just now", "m ago") | yes | Refactor: take the observation `ts` and add a stale threshold |
| `useWeatherData` | `/api/weather` (OWM) | yes | Delete |
| `useAirPollutionData` | `lib/geocodingService.ts:44` → OWM from the browser with `NEXT_PUBLIC_` key | yes | Delete |
| `useDisasterData` | Overpass plus IndexedDB cache (`lib/indexeddb.ts`) | classic only | Delete |
| `useRegionData` | `/api/regions` (Supabase) | yes | Delete |
| `useWaterLevelData` | `/api/water-level` (D1 replay) | **unused** | Delete; rebuild against `/api/v1/observations` |
| `usePumpStatusData` | `/api/pump-status`, **which does not exist** | **unused** | Delete |
| `usePredictionData` | `/api/predict` | **unused** | Delete |
| `useBmkgQuakeData`, `useUIStore`, `useDeviceCapabilities` | various | **unused** | Delete |

---

## 6. Cross-cutting checks

### i18n (Guardrail 15)
- `src/context/LanguageContext.tsx:19` defaults to `'id'`, which is good. The language is not persisted and there is no locale routing.
- `app/layout.tsx:49` hardcodes `<html lang="en">`. `HtmlLangSync` only fixes this after hydration.
- `src/i18n/id.ts` and `en.ts` have matching structure (784 lines each). The keys are for the old public app.
- Coverage: 40 of 158 .tsx files in `app/` and `components/` call `useLanguage`. About 80 non-UI-kit files hardcode strings. NavRail is English ("Command", "Alerts", "Weather"), LeftTile tabs are English ("Forecast", "Map Layers"), FloodMap popups are Indonesian, and `useTimestamp` is English.
- Verdict: Bahasa Indonesia is the default, but text is not ID-first in practice. Keep the mechanism, write a new operator dictionary, and add a lint rule against hardcoded JSX strings.

### Login and access (08)
- **No page requires login.** There is no `middleware.ts` or `proxy.ts`, no login page and no role model in the UI. `lib/supabase/{client,server,admin}.ts` exist. `app/api/preferences/route.ts` is the only `auth.getUser()` call.
- The browser Supabase client writes directly to tables (`app/flood-report/page.tsx:59,199`), which shows that RLS currently allows anonymous inserts.
- Target: an OIDC adapter (Supabase Auth acceptable behind it), a Next middleware gate on every route, server-side role checks in the API, and role-based nav (UI-041, owned with backend-api-engineer).

### Mobile responsiveness
- Approach: Tailwind breakpoints (`lib/constants.ts:102` BREAKPOINTS), plus JS `useMediaQuery('(max-width: 767px)')` that switches `TilingLayout` to `MobileSheet` (bottom sheet via `vaul`), plus NavRail as a bottom tab bar on mobile. The draggable split uses `useLocalStorage`.
- Verdict: reusable. Missing for the target: deep-linkable per-polder URLs for WhatsApp (the current dashboard is one stateful page, tabs live in localStorage) and print or low-bandwidth views. JS-only breakpoints cause hydration flicker. Prefer CSS where possible.

### Data source and "data terakhir" (Guardrail 7)
- No component shows the source station, model version or observation timestamp for a value.
- Timestamps shown are fake or client-side: `FloodRiskForecast.tsx:132-135` (`now()`), `InfrastructureStatusCard.tsx:82,85` (defaults to `new Date()`), `privacy/page.tsx:11` (today), and mock `timestamp: new Date()` in constants.
- "LIVE" and "Real-time" labels sit on mock data (`FloodRiskForecast.tsx:147`, `BottomTile.tsx:327,472`).
- No stale-data greying exists. The DEMO/SIMULASI label exists only as the CCTV page title and in Settings toasts.
- `/api/health` (`app/api/health/route.ts`) returns a Supabase sample row. It does not report connector freshness.

---

## 7. Notes on other components touching the UI
- `app/dashboard/page.tsx:48` has an operator-precedence bug (`A || B ? x : y`), and l.50 HEADs `/api/flood-predict`, which is not a route. The ML badge is therefore meaningless. This goes away with UI-001.
- `components/map/FloodMap.tsx` auto-switches to dark tiles when evacuation is on (l.337-346). Recent commits (`49a23e3`, `ed0ba38`) made evacuation default-on.
- `/api/dashboard` is misnamed: it is an OWM weather proxy (`app/api/dashboard/route.ts:3-5`) with a placeholder-key fallback string.
- `/api/air-quality` returns mock data when `WAQI_API_TOKEN` is unset (l.18).

---

## 8. Inventory and decisions

Owner agents: UI = operator-ui-engineer, BE = backend-api-engineer, SEC = platform-security-engineer, DI = data-ingestion-engineer, EV = evaluation-engineer, ML = hydro-ml-engineer.

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| UI-001 | Dashboard page (D5) | `app/dashboard/page.tsx:9,30-34` uses `generateMockWaterLevels(100)`, `generateMockPumpStatus(100)`, `FLOOD_MOCK_ALERTS`; l.48 precedence bug; `app/page.tsx` redirects here | `08` page 1 Ringkasan; `03` operator workflow | REBUILD | M | UI | UI-041, BE `/api/v1/nowcast/current`, `/api/v1/health` | **G5, G7.** Default route shows random data labeled LIVE. Remove in W1 before any demo. |
| UI-002 | Mock generator module | `lib/mock-data.ts:15-19,42,63,130` (`Math.random`) | `10` #5 | DELETE | S | UI | UI-001 | **G5.** If UI tests need fixtures, use a seeded fixture file behind `NOAH_DEMO_MODE`. |
| UI-003 | Mock constants | `lib/constants.ts:141-224` (`INDONESIA_REGIONS`, `WEATHER_*_MOCK`), `228-349` (`FLOOD_MOCK_ALERTS`), `351-384` (`FLOOD_ZONES_MOCK`), `386-910` (`DASHBOARD_STATS_MOCK`, `LAPORAN_BANJIR_MOCK`, `EVACUATION_LOCATIONS_MOCK`), `912-961` (`CCTV_CHANNELS`) | `10` #5 | REFACTOR | S | UI | UI-001, UI-004, UI-024 | **G5, G3** (phone numbers in evac mock). Keep `DEFAULT_MAP_CENTER`, `MAP_LAYERS`, `BREAKPOINTS`, `FLOOD_RISK_COLORS`; delete the rest. |
| UI-004 | Flood zones layer (D7) | `lib/constants.ts:351-384` has two rectangles; `components/map/FloodMap.tsx:406,855-913`; default ON `lib/mapLayerStore.ts:19` | `04` S4, S15; `08` page 1 | DELETE (layer) | S | UI | none | **G5.** Real replacements are UI-042 (polder boundaries, S8) and UI-052 (BPBD/PetaBencana reports). |
| UI-005 | Main map component | `components/map/FloodMap.tsx` (1339 lines): basemaps, radar, OWM, AQI, evac, routing, geocoding, zones | `08` pages 1 to 3 | REFACTOR | M | UI | UI-004, UI-008 to UI-013 | Extract `OperatorMap` (container, basemap switch, fullscreen, fitBounds, layer slots). Remove `as any` casts and the `@ts-nocheck` in sublayers. |
| UI-006 | Basemaps | `FloodMap.tsx:317-333` (Carto dark, OSM, Esri imagery and topo); `lib/constants.ts:109-125` | `10` #14 (free maps: OSM/MapLibre) | KEEP | S | UI | UI-005 | Check the tile usage policies of OSM, Carto and Esri for a government production deployment (open question Q4). |
| UI-007 | Radar and timeline | `components/map/RadarLayer.tsx`, `TimelineScrubber.tsx`; RainViewer fetch `FloodMap.tsx:418-445` | `04` S5 (BMKG nowcast), Open-Meteo fallback; `08` page 2 rain context | PARK | S | UI | DI S5 connector | **G7.** Could be repointed to BMKG frames from `rain_products`. RainViewer is not a plan source. If kept, label it "RainViewer, bukan BMKG". |
| UI-008 | AQI layers | `components/map/MockAQILayer.tsx:17-60` (hardcoded 34 cities), `AQIPopup.tsx`, `WeatherInsightMap.tsx:71`, `/api/air-quality`, `AirQualityCard.tsx`, `useAirPollutionData` | `01` non-goals | DELETE | S | UI | none | **G5.** |
| UI-009 | Generic weather layers and pages | OWM tiles `FloodMap.tsx:730-758`, `/api/weather/tiles`, `components/weather/*`, `app/weather-forecast`, `app/current-weather`, `components/weather-shortcut.tsx`, `components/panels/WeatherPanel.tsx`, RightTile 'Cuaca' tab, `useWeatherData`, `/api/dashboard` | `01` non-goals | DELETE | M | UI | none | **G10:** `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` is exposed client-side (`lib/geocodingService.ts:4`); rotate per SEC. |
| UI-010 | Overpass flood-prone overlay | `hooks/useDisasterData.ts`, `lib/api.client.ts:39-97`, `CommandCenterView.tsx:478` | none | DELETE | S | UI | UI-034 | OSM tags are not authoritative. |
| UI-011 | Global weather-station markers | `WEATHER_STATIONS_GLOBAL_MOCK` → `CommandCenterView.tsx:483,531,594` → `FloodMap` | none | DELETE | S | UI | UI-034 | **G5.** |
| UI-012 | Shelters / evacuation (D6) | `app/api/evacuation/route.ts:21-30` (random status, **random `verified_by`**); `app/evacuation/page.tsx`; `BottomTile.tsx:27,42,279-394`; `FloodMap.tsx:349-400` pins default ON (`mapLayerStore.ts:23`) | `01` non-goals; `02` D6 | DELETE | S | UI | none | **G5, G1.** Fabricated attribution to BPBD/BNPB is the most serious misrepresentation found. Keep the `evacuation_locations` table only if BPBD asks (PARK data, not UI). |
| UI-013 | OSRM routing | `components/map/EvacuationRouting.tsx`, `components/flood-map/EvacuationRouting.tsx`, `leaflet-routing-machine`, `types/leaflet-routing-machine.d.ts`, geolocation `FloodMap.tsx:362-385` | `01` non-goals | DELETE | S | UI | UI-012 | **G3:** user GPS goes to the public OSRM demo server. Remove the dependency from `package.json`. |
| UI-014 | Citizen SMS subscribe UI | `app/sms-subscribe/page.tsx` → `/api/sms-subscribe`; `NavRail.tsx:48`; `LeftTile.tsx:109-118` (hardcoded "Active") | `10` #1, #3; `08` notes | DELETE | S | UI | SEC/BE remove `sms_subscribers` flow | **G1, G3, G5.** Operator WhatsApp settings move to Admin (UI-047). |
| UI-015 | 34-province region selector | `components/region-selector/RegionDropdown.tsx` (794), `components/tiling/RegionSelector.tsx` (352, Nominatim l.132), `useRegionData`, `/api/regions`, `LocationPickerModal.tsx`, `lib/locationStore.ts` | `01` non-goals | DELETE | S | UI | UI-043 (polder selector) | Replace with a polder or kelurahan picker from `spatial_units`. |
| UI-016 | Chatbot UI | `RightTile.tsx:100-200,541+`, `CommandCenterView.tsx:305`, `app/statistics/components/GeminiChatSection.tsx` → `/api/chatbot` | `02` audit item (chatbot); `01` SCCIC CITYA | PARK | S | UI | BE decision on chatbot | **G5, G7:** tools read the D1 replay. Hide in W1. If revived, it may only cite `/api/v1` data with sources. |
| UI-017 | Public alerts page | `app/alerts/page.tsx:43-60` (hardcoded alerts and fabricated news attributed to KOMPAS, DETIK, etc.); `BottomTile.tsx:642-720` 'berita' | `10` #1, #5 | DELETE | S | UI | none | **G1, G5.** Fake press attribution. Superseded by Rekomendasi (UI-044). |
| UI-018 | Sensor data page | `app/sensor-data/page.tsx:31-77` (50 random reports, random phone numbers l.74); `StatisticsDashboard`; `SensorSimulatorChart` → `/api/sensor-simulator` (CSV replay plus random) | `08` page 2 (level and rain charts) | REBUILD | M | UI | DI S1, BE `/api/v1/observations` | **G3, G5.** Replace with Polder detail (UI-043). |
| UI-019 | Random statistics charts | `components/dashboard/StatisticsDashboard.tsx:30-45` | none | DELETE | S | UI | UI-018 | **G5.** |
| UI-020 | Statistics page | `app/statistics/page.tsx`; `StatistikOverview.tsx:100-106` hardcoded pie; Gemini `/api/analysis` | `08` page 4 Skor; `05` | DELETE | S | UI | UI-045 | **G5, G9.** Reuse the recharts patterns from `StatistikHistorical.tsx` only. |
| UI-021 | Forecast page and layer | `app/flood-predict/page.tsx` → `/api/predict`, `/api/scenarios`; `components/flood-map/PredictionLayer.tsx:84-91` (copies one forecast to 4 points) | `06` (M2 rebuild); `02` D2 to D4 | DELETE | S | UI | ML M2 | **G5.** Scenario UI could return as researcher backtest UI later. |
| UI-022 | Public flood map page | `app/flood-map/page.tsx:70-129` mock reports and evac points; `components/flood-map/PetaBanjirClient.tsx` | `08` page 1 | DELETE | S | UI | UI-042 | **G5.** Salvage `FloodReportPopup` and `FloodReportCard` styles for UI-052. |
| UI-023 | Citizen flood report form | `app/flood-report/page.tsx:59,192-210` (anon insert of `reporter_name`, `reporter_contact`, public photo URL); `components/flood-map/ReportFloodModal.tsx` | `08` (bpbd_pusdalops appends corrections); `10` #3 | DELETE | S | UI | SEC (RLS lockdown) | **G1, G3.** A NEW operator correction form (append-only) belongs to UI-052. |
| UI-024 | CCTV simulation and derived risk | `app/cctv-simulation/page.tsx`; `lib/constants.ts:912-961`; `BottomTile.tsx:492+`; `components/tiling/FloodRiskForecast.tsx:96-135` (hardcoded fallback, weighted mock, `now()` stamp, "LIVE") | `04` S12 (CCTV when granted) | PARK | S | UI | DI S12 | **G5, G7.** Keep only behind `NOAH_DEMO_MODE` with a SIMULASI badge, otherwise remove from nav. |
| UI-025 | Visual verify page | `app/visual-verify/page.tsx` → `/api/verify-visual` (FastAPI YOLO) | `04` S12 | DELETE | S | UI | ML decision on YOLO | Photo upload by the public. Revisit with VIANA. |
| UI-026 | Weather pages | `app/weather-forecast/page.tsx` (996), `app/current-weather/page.tsx` | `01` non-goals | DELETE | S | UI | UI-009 | Covered by UI-009. Listed for page accounting. |
| UI-027 | Education pages | `app/education/page.tsx` plus 4 sub-pages | `01` (no public users) | DELETE | S | UI | none | Content could seed the operator guide (W3), so move the text to `docs/` first. |
| UI-028 | Public marketing and SEO | `public/landing.html`, `about.html`, `data-source.html`, `contact.html`, `privacy.html`, `google39dcc95b5ae64a3b.html`, `public/js/landing.js`, `public/css/landing.css`, `app/sitemap.ts`, `app/data-source/page.tsx`, `app/layout.tsx:27-41` | `08` (no public access) | DELETE | S | UI | none | **G1.** Add `robots: noindex` metadata on the trial deployment. |
| UI-029 | Contact and privacy pages | `app/contact/page.tsx`, `app/privacy/page.tsx:11` (date = today) | `10` #3 (UU PDP) | REFACTOR | S | UI | Q7 | Keep one operator privacy notice (PDP) behind login. Drop contact. |
| UI-030 | Settings page | `app/settings/page.tsx` (RegionDropdown, `/api/preferences`, "(Simulasi)" notification toasts) | `08` (user profile) | REBUILD | S | UI | UI-041 | Becomes profile (language, theme). Notification channels are admin-only. |
| UI-031 | App shell and navigation | `components/layout/ClientLayoutWrapper.tsx:44-49`, `NavRail.tsx:35-51`, `StatusBar.tsx`, `PageShell.tsx`, `CommandMenu.tsx` | `08` UI pages 1 to 6 | REFACTOR | M | UI | UI-041 | Nav: Ringkasan, Polder, Rekomendasi, Skor, Laporan, Admin, filtered by role. |
| UI-032 | Tiling layout system | `components/tiling/TilingLayout.tsx`, `TilePanel.tsx`, `DragDivider.tsx`, `SegmentedControl.tsx`, `MobileSheet.tsx`, `TilingModeContext.tsx`, `TilingStatusBar.tsx`, `tiling.css` | `08` page 1 | REFACTOR | M | UI | UI-001 | Good desktop and phone frame. Replace tile contents and the alert ticker (`TilingLayout.tsx:47-49`, G5). |
| UI-033 | Dashboard data context | `components/tiling/DashboardDataContext.tsx` (untyped `any[]`) | `03` API v1 | REFACTOR | S | UI | BE API | Typed context with `issued_at`, `model_version`, `source` per item. |
| UI-034 | Classic and dead dashboards | `components/layout/CommandCenterView.tsx` (672), `DashboardClientPage.tsx` (925, unused), `Header.tsx`, `Sidebar.tsx`, `Footer.tsx`, `SplashScreen.tsx` (unused) | none | DELETE | S | UI | UI-001 | About 2,500 lines removed. |
| UI-035 | Other dead or test files | `components/MapDisplay.tsx`, `background/Lightning.*`, `dashboard/AnalysisSection.tsx`, `flood-map/MapFilterControl.tsx`, `flood-map/ReportFloodControl.tsx`, `flood/FloodAlert.tsx`, `sensor-data/{CurrentWeatherModal,FloodReportList,HistoricalRainfallChart,ReportEmergencyModal}.tsx`, 7 files in `components/weather/`, `app/test/route.ts`, `app/api/test/route.ts`, `app/api/test.css` | none | DELETE | S | UI | none | Grep found no importers. Confirm with `tsc` after deletion. |
| UI-036 | Unused or broken data hooks | `hooks/useWaterLevelData.ts` (D1 replay), `usePumpStatusData.ts` (calls `/api/pump-status`, not found), `usePredictionData.ts`, `useBmkgQuakeData.ts`, `useUIStore.ts`, `useDeviceCapabilities.ts`; `lib/api.client.ts:114-148` | `03` API v1 | DELETE | S | UI | none | New hooks in UI-053. |
| UI-037 | Freshness hook | `hooks/useTimestamp.ts` (fetch time, English strings) | `10` #7, #15 | REFACTOR | S | UI | UI-033 | Input = observation `ts`. Output "data terakhir 13:05 WIB (7 mnt lalu)" plus a stale flag. |
| UI-038 | Provenance and "data terakhir" component | not found. Fake stamps at `FloodRiskForecast.tsx:132`, `InfrastructureStatusCard.tsx:82,85`; "LIVE" at `FloodRiskForecast.tsx:147`, `BottomTile.tsx:327,472` | `10` #7; CLAUDE.md rule 6 | NEW | M | UI | BE payload fields | `<SourceStamp source station model ts staleAfter>`; greys stale values (stale after 15 min, matching G12). |
| UI-039 | Demo labeling | not found (only `app/cctv-simulation` title and Settings "(Simulasi)" toasts) | `10` #5 | NEW | S | UI | SEC flag `NOAH_DEMO_MODE` | Global "SIMULASI" banner and per-value badge whenever any value is synthetic. |
| UI-040 | i18n | `src/context/LanguageContext.tsx:19` (default `id`, not persisted); `src/i18n/{id,en}.ts`; `app/layout.tsx:49` `lang="en"`; about 80 files with hardcoded strings (e.g. `NavRail.tsx:35-51`, `LeftTile.tsx:12-17`) | `10` #15; CLAUDE.md conventions | REFACTOR | M | UI | UI-031 | New operator dictionary (ID first); SSR `lang="id"`; persist choice; lint against raw JSX strings. |
| UI-041 | Login and role gate | not found: no `middleware.ts` or `proxy.ts`, no login page; only `app/api/preferences/route.ts:11,46` calls `auth.getUser()`; anon browser writes `app/flood-report/page.tsx:199` | `08` (every page requires login); `03` OIDC adapter | NEW | M | BE + UI | SEC (RLS), BE (OIDC adapter) | Middleware redirects to `/masuk`; role from token; per-role nav; `pump_operator` scoped to one polder; actions written to `audit_log`. |
| UI-042 | Ringkasan page | not found | `08` page 1; `03` workflow steps 1 to 3 | NEW | M | UI | UI-005, UI-032, UI-038, BE nowcast and health | Polders coloured by probability (60/120/180 min selector via `TimelineScrubber`), open recommendation count, connector health strip. |
| UI-043 | Polder detail page | not found (closest: `app/sensor-data`, `SensorSimulatorChart.tsx`, `FloodReportChart.tsx`, `InfrastructureStatusCard.tsx`) | `08` page 2; `07` M3 | NEW | L | UI | BE `/api/v1/polders/{id}/status`, `/observations` | `/polder/[code]` deep link for WhatsApp; level chart with Siaga lines from station config (D12); rain chart; pumps; time to full; history. |
| UI-044 | Rekomendasi page | not found | `08` page 3; `03` workflow step 4; `10` #16, #17 | NEW | M | UI | BE `/api/v1/recommendations`, ack POST | Ack plus action (followed, deferred, ignored) plus note. Wording "Saran, keputusan di tangan operator". No public channel. |
| UI-045 | Skor page | not found (chart patterns: `app/statistics/components/StatistikHistorical.tsx`) | `08` page 4; `05` M1; `10` #9 | NEW | M | UI + EV | EV scoreboard API | POD, FAR, CSI, Brier and lead time per source and lead, with baseline next to each. No accuracy or R2. Plain-language explanations. |
| UI-046 | Laporan page | not found | `08` page 5; `05`; `09` W4 to W6 | NEW | S | UI + EV | EV weekly report API | List by ISO week, HTML view and PDF export (`dsda_supervisor`). |
| UI-047 | Admin page | not found (`components/map/MapPicker.tsx` reusable for geometry) | `08` page 6 | NEW | L | UI + BE | UI-041, BE admin API | Users and roles, stations (datum, Siaga thresholds as config, D12), trigger-to-action table, connectors, WhatsApp recipients (encrypted, G3). |
| UI-048 | Connector health strip | not found (`app/api/health/route.ts` returns a Supabase sample; `StatusBar.tsx` shows a clock and LSTM status) | `03` `/api/v1/health`; `10` #12 | NEW | S | UI | BE health endpoint | Per-connector freshness. Red if stale over 15 min. Shown on every page. |
| UI-049 | Mobile approach | `useMediaQuery('(max-width: 767px)')` in `TilingLayout.tsx:20`, `MobileSheet.tsx` (vaul), NavRail bottom bar, Tailwind breakpoints | `08`; operator-ui role (phone via WhatsApp links) | KEEP | S | UI | UI-042, UI-043 | Add deep-linkable routes. Prefer CSS breakpoints to avoid hydration flicker. |
| UI-050 | PWA and service worker | `next.config.js:3-6`, committed `public/sw.js`, `public/workbox-4754cb34.js` (plus `.map`) | `10` #7 | REFACTOR | S | UI | none | Network-only for `/api/*`; show an offline banner instead of cached numbers. Stop committing generated SW files. |
| UI-051 | Charts | recharts in `FloodReportChart.tsx`, `SensorSimulatorChart.tsx`, `StatistikHistorical.tsx`; `components/ui/Sparkline.tsx`; random sparkline `components/panels/DataPanel.tsx:33-44` | `08` pages 2 and 4 | REFACTOR | S | UI | UI-043, UI-045 | **G5:** DataPanel sparkline fabricates history. Build `LevelChart` and `RainChart` with WIB axis and threshold lines. |
| UI-052 | Flood reports layer and correction form | not found (commented-out BPBD and crowd layers `FloodMap.tsx:787-850`; popup patterns `components/flood-map/FloodReportPopup.tsx`) | `04` S4, S15; `08` bpbd_pusdalops; `10` #6 | NEW | M | UI | DI S4/S15, BE `flood_reports` API | RT-level polygons or points with source and time. Corrections are appended, not edited. |
| UI-053 | API client and hooks for v1 | `lib/api.client.ts`, `lib/api.ts`, `lib/api.server.ts` (old endpoints, OWM, Overpass, Nominatim) | `03` API v1 | REBUILD | M | UI | BE OpenAPI spec | Generate a typed client from OpenAPI. React Query is already provided (`components/providers/ReactQueryProvider.tsx`). |
| UI-054 | UI kit | `components/ui/*` (shadcn/radix, 37 files), `components.json`, `tailwind.config.ts` | all pages | KEEP | S | UI | none | Fine as is. |
| UI-055 | Leaflet utilities | `lib/leaflet-fix.ts`, `components/flood-map/MapInvalidator.tsx`, `MapEventsHandler.tsx`, `lib/mapUtils.ts` | `08` map pages | KEEP | S | UI | none | |
| UI-056 | Map picker | `components/map/MapPicker.tsx` (OSM; unpkg marker icons l.113-115) | `08` page 6 Admin | KEEP | S | UI | UI-047 | Serve marker icons locally (`public/leaflet/` exists) instead of unpkg. |
| UI-057 | Map controls and legend | `components/map/MapControls.tsx`, `MapLegend.tsx`, `lib/mapLayerStore.ts` | `08` pages 1 and 2 | REFACTOR | S | UI | UI-005 | Layers: polders, nowcast, BPBD reports, stations, pumps. Legend for probability classes and Siaga. |
| UI-058 | Warning-style components | `components/flood/PeringatanBencanaCard.tsx` (+ .css), `components/contexts/AlertCountContext.tsx` (polls `/api/alerts` every 30 s) | `10` #1 | DELETE | S | UI | UI-044 | "Peringatan" wording implies an official warning. Rekomendasi replaces it. |
| UI-059 | Geocoding and search | OWM geocoding `lib/geocodingService.ts:19-41`, Nominatim `lib/api.client.ts:187-195`, `RegionSelector.tsx:132`, `components/flood-map/MapSearchControl.tsx` | none | DELETE | S | UI | UI-015 | Search by polder or kelurahan name over `spatial_units` instead. |
| UI-060 | BMKG earthquake widget | `app/dashboard/page.tsx:20-27` → `lib/api.client.ts:150-162`; `BottomTile.tsx:253` 'earthquake' tab | `01` (flood scope) | DELETE | S | UI | UI-001 | Not flood-related. |
| UI-061 | ML status widgets | `components/dashboard/MLStatusCard.tsx`, `components/panels/AIToolsPanel.tsx:46-60`, `StatusBar.tsx:143-150` ("LSTM") | `06` (model rebuilt); `10` #7 | REFACTOR | S | UI | ML model registry | Show `model_version` and last run time from the nowcast payload instead of an LSTM ping. |
| UI-062 | Root metadata and fonts | `app/layout.tsx:14-41` (Space Grotesk, JetBrains Mono via next/font; title "AI Flood Command Center"; SMS claim) | `01` product brief | REFACTOR | S | UI | UI-028 | Title "Noah AI, Pendukung Keputusan Pengendalian Banjir"; `lang="id"`; noindex. |

Guardrail tally across rows: G1: UI-012, 014, 017, 023, 028, 058. G3: UI-003, 013, 014, 018, 023, 047. G5: UI-001 to 004, 008, 011, 012, 014, 016 to 022, 024, 032, 039, 051. G7: UI-001, 007, 016, 024, 037, 038, 050, 061. G10: UI-009. G15: UI-037, 040. G16/G17: UI-044.

---

## 9. Reuse map (existing component to target page)

| Existing | Ringkasan | Polder detail | Rekomendasi | Skor | Laporan | Admin |
|---|---|---|---|---|---|---|
| `FloodMap.tsx` shell (container, basemap switch l.317-333, fullscreen, flyTo), extracted as `OperatorMap` | yes (main) | yes (mini map) | yes (destination map) | | | yes (stations map) |
| `RadarLayer.tsx` + `TimelineScrubber.tsx` | yes (lead-time slider; BMKG frames later) | yes (rain animation) | | | | |
| `MapControls.tsx`, `MapLegend.tsx`, `lib/mapLayerStore.ts` | yes | yes | | | | |
| `leaflet-fix.ts`, `MapInvalidator.tsx`, `MapEventsHandler.tsx`, `mapUtils.ts` | yes | yes | yes | | | yes |
| `MapPicker.tsx` | | | | | | yes (station and pump geometry) |
| `FloodReportPopup.tsx` / `FloodReportCard.tsx` (styles only) | yes (BPBD report popups) | yes | | | | |
| `components/tiling/*` (TilingLayout, TilePanel, DragDivider, SegmentedControl, MobileSheet) | yes (frame) | yes (tabs) | | | | |
| `ClientLayoutWrapper`, `NavRail`, `PageShell`, `CommandMenu` | yes | yes | yes | yes | yes | yes |
| `StatusBar` / `TilingStatusBar` | yes (connector health strip) | yes | yes | yes | yes | yes |
| `InfrastructureStatusCard.tsx` (table pattern) | | yes (pumps table) | | | | yes (stations list) |
| `DashboardStats.tsx` (stat tiles) | yes (KPI row) | yes | | yes | | |
| `DataPanel.tsx` (list layout, minus random sparkline) | yes (polder list) | | yes (queue list) | | | |
| recharts patterns (`SensorSimulatorChart`, `FloodReportChart`, `StatistikHistorical`), `ui/Sparkline` | | yes (level and rain charts) | | yes (metric trends) | yes | |
| `components/ui/*` (dialog, form, select, tabs, toast, badge, table-like cards) | yes | yes | yes (ack form: `form`, `radio-group`, `textarea`) | yes | yes | yes (CRUD forms) |
| `react-hook-form` + `zod` (`lib/schemas.ts` pattern) | | | yes (ack form) | | | yes |
| `LanguageContext` + `src/i18n` mechanism | yes | yes | yes | yes | yes | yes |
| `useMediaQuery`, `useLocalStorage`, `useTheme`, `use-toast`, `ReactQueryProvider` | yes | yes | yes | yes | yes | yes |
| `useTimestamp` (refactored) to `SourceStamp` | yes | yes | yes | yes | yes | |
| `lib/supabase/{client,server}.ts` (behind OIDC adapter) | auth | auth | auth | auth | auth | auth |
| Sentry (`instrumentation*.ts`, `next.config.js`) | kept app-wide | | | | | |

Not reusable: anything that reads `lib/mock-data.ts`, `*_MOCK` constants, OWM, WAQI, Overpass, OSRM, Nominatim, `/api/evacuation`, `/api/sensor-simulator`, `/api/water-level`, `/api/predict`.

---

## 10. Open questions

| # | Question | Who can answer |
|---|---|---|
| Q1 | Should the chatbot (UI-016) be hidden in W1 and revived later as an operator assistant, or deleted? Should it align with SCCIC CITYA instead? | Ari, SCCIC |
| Q2 | Should demo or simulator screens (CCTV simulation, M3 simulator mode) be visible to operators during shadow mode, or only to `researcher` and `admin`? | Ari, DSDA |
| Q3 | Which identity provider will host the trial login (Supabase Auth behind an adapter, or a local Keycloak now)? This decides the shape of the login page and middleware. | Ari, SCCIC |
| Q4 | Basemap licensing for a government deployment: may we use public OSM, Carto and Esri tiles, or must we self-host (MapLibre plus OSM extract)? Is the DKI or BIG basemap available? | Ari, DSDA |
| Q5 | Should the WhatsApp deep links (Polder detail, Rekomendasi item) open without a fresh login on a phone? This needs session length and magic-link policy. | Ari, DSDA (security) |
| Q6 | Should English be kept at all for operators, or should we ship ID only and keep the EN dictionary for researchers? | Ari |
| Q7 | Which privacy notice text is required under UU PDP for operator accounts? | Ari, DSDA legal |
| Q8 | Do Posko screens have a fixed resolution or wall display? This affects Ringkasan density. | DSDA |
| Q9 | Shelter data (35 rows): should it be deleted, or kept as a static layer for BPBD Pusdalops? The plan says out of scope. | Ari, BPBD |
| Q10 | Should the RainViewer radar stay as a labeled fallback until BMKG frames are available, or show nothing? | Ari, BMKG agreement |
| Q11 | What should happen to the public domain `noah.ai.id` (current public app, Google-verified) when the trial starts: take it down, redirect to login, or keep a static "about" page? | Ari |
