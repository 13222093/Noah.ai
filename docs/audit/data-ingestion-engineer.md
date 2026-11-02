# Data ingestion audit (Phase A, audit only)

Author: `data-ingestion-engineer`. Date: 2026-11-02. Scope: every fetcher and external call, every Supabase table, migration and seed, timestamp and unit handling, replayed or fake data, bundled data files, and coverage of sources S1 to S17 (`docs/plan/04_DATA_SOURCES.md`) against the target data model (`docs/plan/03_TARGET_ARCHITECTURE.md`, "Data model (minimum)").

Method: read-only inspection of tracked files (`git ls-files`, 381 files), excluding `node_modules/`, `.next/`, `files/`, `docs/plan/`, `.claude/`. Line numbers are from the current working tree. Secret values are never reproduced. Where a file is cited for a secret, only its kind and location are given.

## Summary

- **No real ingestion exists.** No code fetches Posko Banjir DSDA (S1), BPBD Info Banjir (S4), BMKG nowcast (S5), or any other primary operational source. The only live hydrological-adjacent call is a PetaBencana passthrough (S15) that stores nothing.
- **The "live" Manggarai water level (D1) is a replay of January 2020 data, and its units are wrong too.** `DATASET_FINAL_TRAINING.csv` holds Manggarai TMA in **decimetres** (55.15 to 96.75), but `app/api/water-level/route.ts` returns it as `water_level_cm`. The 400/700/850 thresholds therefore never fire: risk is always `AMAN`, even for the 1 January 2020 flood peak (967 cm).
- **The bundled `tma_2020.xlsx.csv` is useful.** It covers 21 DSDA posts from 2019-12-23 to 2020-01-31, stores levels in **mm**, and its `status_siaga` transitions confirm the official Manggarai thresholds exactly: Siaga 3 starts at 7500 mm, Siaga 2 at 8510 mm and Siaga 1 at 9520 mm, which are 750/850/950 cm. It is the best fixture and threshold evidence in the repository.
- **None of the 14 target tables exist.** The 7 tables in migrations (plus 5 more used by the code but never migrated) are all public-facing hackathon tables. Three of them carry or expose personal data, and two are seeded with fabricated alerts and incidents.
- **Time handling is not normalized anywhere.** Replay endpoints index by server-local `getHours()`/`getDate()` and stamp `now()`. Bundled CSVs have naive timestamps. None of the 37 `toLocale*String` calls in the UI passes `timeZone: 'Asia/Jakarta'`, even where "WIB" is hardcoded next to the time.
- **Guardrail violations found in the ingestion domain:** #1, #3, #5, #6 (no append-only enforcement), #7, #8, #10 and #12. Details are in the inventory and in "Guardrail violations".

Decision counts (rows DI-001 to DI-062): **KEEP 0, REFACTOR 4, REBUILD 11, NEW 20, DELETE 20, PARK 7** (62 rows).

## Inventory and decisions

Legend: G# = guardrail number in `docs/plan/10_GUARDRAILS.md`; D# = known defect in `docs/plan/02_CURRENT_STATE_AND_AUDIT.md`.

### A. Fetchers and external calls

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| DI-001 | Manggarai "live" water level (D1) | `app/api/water-level/route.ts:20-44` reads `ml-service/data/DATASET_FINAL_TRAINING.csv`. `:46-53` replay index = `(getDate()-1)*24 + getHours()` mod 744 (server-local time). `:74`, `:92` stamp `new Date().toISOString()` as the reading time. `:93` labels the value `water_level_cm`, but the CSV column is decimetres. `:85-88` thresholds are 400/700/850. Consumers: `app/api/predict/route.ts:25`, `lib/api.client.ts:114-130` (expects an array, gets an object), chatbot tool `app/api/chatbot/route.ts:175` | `04` S1 and S13; `03` Connectors; `observations` | REBUILD | M | data-ingestion-engineer | DI-044, DI-046, DI-047, DI-057 | **G3/G5, G7, G8.** Replace with a polite S1 connector: one request per 5 min, identified User-Agent, raw XML/HTML to object storage, normalized rows per post. Delete the replay. The unit error means anything downstream that "works" today is wrong by 10x |
| DI-002 | Sensor simulator | `app/api/sensor-simulator/route.ts:48-66` is a `Math.random()` fallback (`source: 'random_fallback'`). `:68-90` is the same replay as D1, plus `:77-84` "minute jitter to make it feel live" and thresholds 400/700/850 at `:60-63` and `:87-90`. Consumer: `components/sensor-data/SensorSimulatorChart.tsx:32` | `10` #5 | DELETE | S | data-ingestion-engineer | none | **G5.** If a UI test fixture is needed, serve saved S1 fixtures behind `NOAH_DEMO_MODE=true` with a "SIMULASI" label |
| DI-003 | Dual rainfall (OpenWeatherMap) | `app/api/rainfall-dual/route.ts:12-15` uses two fixed points (Bogor, Jakarta). `:28-45` calls OWM `/data/2.5/weather` on every request with no cache. `:48-49` reads `rain.1h` (mm in the last hour), and a missing field becomes `0`. `:64` stamps `now()` instead of the OWM `dt`. Key: `OPENWEATHER_API_KEY` from env | `04` S5 fallback (Open-Meteo); `03` `rain_products` and `observations` (kind=arr) | REBUILD | S | data-ingestion-engineer | DI-057 | **G5** (missing becomes zero, which invents data), **G7, G14.** OWM is not in S1 to S17; the plan's free fallback is Open-Meteo. Rebuild as an Open-Meteo connector with a visible "fallback" label, a `quality_flag`, and nulls for gaps |
| DI-004 | PetaBencana (S15) | `app/api/disaster-proxy/route.ts:21` calls `https://api.petabencana.id/reports?disaster=…&timeperiod=…&geoformat=geojson`. No key (`:13` commented). `:28` sends User-Agent `noah.ai/1.0`. `:25` uses `cache: 'no-store'` and nothing is stored. There is no Jakarta filter. `:15-19` maps only `24h`/`3d`, so the default `1h` from `lib/api.client.ts:166` silently becomes 24 h. The only consumer is the chatbot tool (`app/api/chatbot/route.ts:178-180`); no map layer uses it | `04` S15; `03` `flood_reports(source=petabencana)` | REBUILD | S | data-ingestion-engineer | DI-044, DI-051, DI-057 | **G6, G7.** Poll every 5 to 10 min, filter to DKI, upsert-free append with `raw_ref`, and map points to RT/kelurahan in `spatial_units`. Confirm the current API host and terms (Q6) |
| DI-005 | "disaster-reports" stub | `app/api/disaster-reports/route.ts:54-59` returns a fabricated body `{message: "Data from Peta Bencana API", timestamp: now()}`, cached in Upstash (`:62`), behind a per-IP rate limit. It makes no external call | `10` #5 | DELETE | S | data-ingestion-engineer | none | **G5.** Presents nothing as if it were PetaBencana data |
| DI-006 | Flood zones layer (D7) | `lib/constants.ts:351-384` `FLOOD_ZONES_MOCK` is two hardcoded rectangles (Kelapa Gading, Cempaka Putih) with invented population and area, and `lastUpdate: new Date()` at `:365` and `:381`. Rendered from `components/map/FloodMap.tsx:65`, `:406`, `:855-` | `04` S4, S15; `03` `flood_reports` and `spatial_units` | REBUILD | M | data-ingestion-engineer (data), operator-ui (layer) | DI-004, DI-007, DI-044 | **G5, G7.** D7 confirmed. The layer must read `flood_reports` and RT/kelurahan geometry only |
| DI-007 | BPBD Info Banjir (S4) | Not found as a fetcher. Only a UI toggle exists: `components/map/FloodMap.tsx:405` `showOfficialBPBDData`, with the layer commented out at `:820` | `04` S4; `03` `flood_reports(source=bpbd_rt)` | NEW | M | data-ingestion-engineer | DI-044, DI-051, DI-057 | **G4, G3** (RT level only, no individuals). Hourly polite scrape of `bpbd.jakarta.go.id/infobanjir`: RT code, `ts_start`/`ts_end`, `depth_cm`. The archive comes by request |
| DI-008 | BMKG nowcast (S5) | Not found. The only trace is a commented-out tile overlay `https://nowcast.bmkg.go.id/data/radar/composite/{z}/{x}/{y}.png` in `components/flood-map/PetaBanjirClient.tsx:310-318`. That URL is unverified | `04` S5; `03` `rain_products(kind=nowcast)` | NEW | M | data-ingestion-engineer | DI-050, DI-057 | **G4, G7.** Fetch the public nowcast images every 10 min into object storage and record `issued_at`/`valid_at`. Gridded data comes later under the research agreement |
| DI-009 | RainViewer radar | Browser-direct calls: `components/map/FloodMap.tsx:412-430` and `components/map/WeatherInsightMap.tsx:149`, `:242-248` call `api.rainviewer.com/public/weather-maps.json` and `tile.rainviewer.com`. No key, no server cache, nothing stored | Not in S1 to S17 | PARK | S | operator-ui | none | Visual context only. Never an M2 input and never stored as `rain_products`. Licence and coverage need checking (Q9) |
| DI-010 | OpenWeatherMap weather, forecast, air pollution, history, tiles, geocoding | `app/api/weather/route.ts:9`, `:20-36` (no cache). `app/api/dashboard/route.ts:3` falls back to a literal placeholder key string, and `:22`, `:47` use `revalidate: 0`. `app/api/weather-history/route.ts:15`, `:25` use the paid One Call 3.0 API and ignore `end`. `app/api/weather/tiles/[...tile]/route.ts:8`, `:21-24` revalidate every 3600 s. Keys read in the browser: `lib/geocodingService.ts:4-48`, `components/weather/WeatherMapIframe.tsx:299-303`, `components/weather-shortcut.tsx:47-53`, `app/weather-forecast/page.tsx:397`, `:539`, `:574`, `components/map/FloodMap.tsx:754`, `components/weather/WeatherMap.tsx:214-230`. Four env names are in use: `OPENWEATHER_API_KEY`, `OPEN_WEATHER_API_KEY`, `NEXT_PUBLIC_OPENWEATHER_API_KEY`, `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` | `02` likely outcome (general weather layers out of scope) | DELETE | S | data-ingestion-engineer | DI-003 | **G10** (keys exposed to the browser via `NEXT_PUBLIC_*`), **G14** (paid One Call 3.0). Not in S1 to S17 |
| DI-011 | WAQI air quality | `app/api/air-quality/route.ts:14`. When `WAQI_API_TOKEN` is missing, `:17-30` returns a canned AQI 42 for a "Demo Location" with `now()` and a fake `tz: '+07:00'`. Real calls at `:34-39` use `revalidate: 300` | Out of scope | DELETE | S | data-ingestion-engineer | none | **G5** (canned response) |
| DI-012 | BMKG earthquake (autogempa) | `lib/api.client.ts:150-162` calls `data.bmkg.go.id/DataMKG/TEWS/autogempa.json` with `revalidate: 60`. Used by `app/dashboard/page.tsx:23` and a chatbot tool | Out of scope (flood operations only) | DELETE | S | data-ingestion-engineer | none | Not a flood source |
| DI-013 | Overpass OSM waterways | `lib/api.client.ts:39-97` POSTs to `overpass-api.de` for waterway, water, dyke, basin and wetland features, with `revalidate: 3600` and an IndexedDB cache (`hooks/useDisasterData.ts:4`, `:43`) | `04` S8 fallback (manual digitizing) | PARK | S | data-ingestion-engineer | DI-044 | **G13** (ODbL attribution). At most a one-off import into geodata for lighthouse polders, never a live call |
| DI-014 | Nominatim geocoding | `lib/api.client.ts:187-211` (User-Agent set), plus browser-direct calls in `components/tiling/RegionSelector.tsx:132`, `:194` and `app/flood-report/page.tsx:78`, with no throttling | Out of scope | DELETE | S | operator-ui | none | Breaks Nominatim's one-request-per-second policy when called from browsers. Operators pick polders, not addresses |
| DI-015 | CCTV snapshot to detection (S12) | `app/api/cctv-scan/route.ts:14-31` fetches any `source_url` from the request body (an SSRF risk) and `:46` forwards it to the ML service. `ml-service/src/yolo_model.py:27-67` calls `serverless.roboflow.com`, and **`:48` has a hardcoded fallback Roboflow API key (D11)**. `docker-compose.yml` interpolates the key from env, which is correct. The `detections` table is never written | `04` S12; `03` `flood_reports(source=cctv)` | REBUILD | M | data-ingestion-engineer, platform-security | DI-057; S12 access | **G10** (D11 confirmed at `yolo_model.py:48`). Rebuild when S12 is granted, with allowlisted snapshot URLs, snapshots in object storage, and detections as append-only rows. W1: rotate and remove the key |
| DI-016 | Predict "auto mode" inputs | `app/api/predict/route.ts:20-42` pulls the replayed level (DI-001) and OWM rain (DI-003). `:33` defaults to `300` cm when no level arrives. `app/api/smart-alert/route.ts:34`, `:120-139` chains this to public SMS | `06`; `03` Connectors and `observations` | REBUILD | S | hydro-ml-engineer (model), data-ingestion-engineer (inputs) | DI-001, DI-047 | **G5** (invented 300 cm), **G1** (public SMS chain). Model inputs must come only from `observations` and `rain_products`, with source and timestamp |
| DI-017 | Chatbot data tools | `app/api/chatbot/route.ts:50-57`, `:175-199`: `fetchWaterLevelData` returns the replay, `fetchPumpStatusData` calls a missing route (DI-018), and the other tools call PetaBencana, BMKG quake and OWM | `02` chatbot item | PARK | S | backend-engineer | DI-047 | **G5, G7.** If revived as an operator assistant, its tools may read only from the store, with provenance |
| DI-018 | Pump status fetch path | `lib/api.client.ts:132-148` calls `/api/pump-status`, a route that does not exist. Also `hooks/usePumpStatusData.ts`. `lib/api.ts:98-112` `PumpData` has `kapasitas_liter_per_detik` (L/s) | `03` `pumps` and `pump_states`; `04` S6, S7 | DELETE | S | data-ingestion-engineer | none | **G8** (L/s versus target m3/s). Dead code. Replaced by DI-048 and DI-049 |
| DI-019 | Dashboard mock data (D5) | `lib/mock-data.ts:15-17` random helpers. `:23-47` water levels in **metres** (`unit: 'm'`, 0.5 to 4.0), random status, random timestamp in the last hour. `:49-66` random pumps, with `updated_at` as an epoch-ms number. Used unconditionally at `app/dashboard/page.tsx:9`, `:30-31`, plus `FLOOD_MOCK_ALERTS` at `:33-34` | `03` `observations`, `pump_states` | REBUILD | M | data-ingestion-engineer (data), operator-ui | DI-001, DI-049 | **G5, G7, G8.** D5 confirmed |
| DI-020 | Hardcoded station fallback in forecast tile | `components/tiling/FloodRiskForecast.tsx:96-104` has four fixed stations. Manggarai is shown at 850 cm labelled "Siaga 3", but 850 is the Siaga 2 boundary. `:115-116` guesses units ("> 50 means cm, else m") | `03` `stations`; `04` connector rules | REBUILD | S | operator-ui | DI-046 | **G5, G8,** D12 |
| DI-021 | Siaga thresholds in code (D12) | 400/700/850 at `app/api/water-level/route.ts:85-88`, `app/api/sensor-simulator/route.ts:60-63` and `:87-90`, and `ml-service/src/main.py:219-232` and `:372-381`. 150/100 "contoh Manggarai" at `ml-service/src/metrics.py:64-65`. Free text "850 cm (Siaga 3)" at `supabase/seed.sql:78`. Inverted severity order (Siaga 3 above Siaga 1) at `components/tiling/RightTile.tsx:72` and `components/tiling/TilingLayout.tsx:35`. Evidence for the official values: `tma_2020.xlsx.csv` Manggarai `status_siaga` changes at 7500/8510/9520 mm, Depok at 2000/2700/3690 mm, Katulampa Siaga 3 at 800 mm | `04` connector rules (Manggarai 750/850/950 cm); `03` `stations.siaga_thresholds` | REFACTOR | S | data-ingestion-engineer | DI-046 | **G7, G8.** D12 confirmed. Thresholds become per-station configuration loaded from DSDA's table. Code reads config only |
| DI-022 | Health endpoints | `app/api/health/route.ts:21` checks only that Supabase `provinces` is readable. `app/api/ml-health/route.ts:7` pings the ML service | `03` API `GET /api/v1/health`; `04` connector rules | REBUILD | S | data-ingestion-engineer, backend-engineer | DI-057 | **G12.** Must report per-connector last success, last `ts`, and lag, and alert when a connector is stale for more than 15 min |
| DI-023 | Cache and rate-limit libraries | `src/lib/cache.ts`, `src/lib/redis.ts` (Upstash, falls back to a no-op `:39-51`), `src/lib/rateLimiter.ts`, `lib/simple-rate-limit.ts` (inbound, per IP, in memory). No outbound backoff exists anywhere | `03` API; `04` "exponential backoff" | REFACTOR | S | backend-engineer | none | Keep inbound limiting for the API. Connectors (Python) get their own backoff and conditional requests (ETag/If-Modified-Since). Upstash is optional under **G14** |
| DI-024 | Timestamp creation and parsing (cross-cutting) | See "Timestamps and time zones" below. Main issues: server-local `getHours()` (DI-001, DI-002), `now()` stamped as observation time (DI-001, DI-003, `lib/constants.ts:365`, `:381`, `:392`, `:400-642`), naive CSV times, no `Asia/Jakarta` in display | `10` #8; CLAUDE.md conventions | REFACTOR | M | data-ingestion-engineer (storage), operator-ui (display) | DI-044 | **G7, G8.** Rule: parse source local time explicitly as `Asia/Jakarta`, store `timestamptz` in UTC, format with `timeZone: 'Asia/Jakarta'` |

### B. Bundled data files

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| DI-025 | `ml-service/data/DATASET_FINAL_TRAINING.csv` | 744 rows, hourly, 2020-01-01 00:00 to 2020-01-31 23:00, naive time. Columns `Unnamed: 0, hujan_bogor, hujan_jakarta, tma_manggarai`. `tma_manggarai` ranges 55.15 to 96.75, which is **decimetres** (tma_2020 mm / 100). Rain columns are presumably mm per hour; their source is undocumented. Read at runtime by DI-001 and DI-002 | `10` #5 | DELETE | S | data-ingestion-engineer | DI-001, DI-002 | **G5, G8.** Remove it from the runtime path. hydro-ml may keep a copy under a research folder with documented units |
| DI-026 | `ml-service/data/tma_2020.xlsx.csv` | 31,059 rows, 21 DSDA posts (Katulampa, Depok, Manggarai, Karet, Marina, Pasar Ikan, Pluit, Sunter Hulu, others), 2019-12-23 to 2020-01-31. Nominally 30-min intervals, irregular, with duplicate timestamps (168 at Manggarai, 227 at Katulampa, 286 at Depok). `tinggi_air` is in **mm** (Manggarai 4870 to 9690). Negative values at Pluit (down to -2090), Cideng and Cibalok point to datum issues. `status_siaga` is free text. Coordinates are included. Format matches the Open Data Jakarta TMA datasets (S2). Not read by any code | `04` S2; `03` `observations`, `stations` | REFACTOR | S | data-ingestion-engineer | DI-044, DI-046, DI-047 | **G7, G8.** Import once as an S2 archive (`source='s2_opendata'`, mm to cm, duplicates and negatives flagged, not dropped). Use it as a parser fixture and as evidence for thresholds and station coordinates. Confirm provenance and licence (Q1) |
| DI-027 | `ml-service/data/hujan_bogor2022.csv` | 17,544 rows, hourly, 2022-01-01T00:00 to 2024-01-01T23:00, header `time,precipitation (mm)`. This looks like an Open-Meteo archive export (assumption). Time zone unknown; Open-Meteo defaults to GMT unless a time zone is requested. Not read by code | `04` S5 fallback; `06` training | PARK | S | hydro-ml-engineer | none | **G7, G8.** Label it as modelled or reanalysis rain, not gauge observation. Confirm the source and time zone (Q10) |
| DI-028 | `ml-service/models/preprocessed_data.csv` | 720 rows, **all timestamps `1970-01-01 00:00:00`**, an epoch parse bug in `ml-service/src/preprocessing.py:72` and `:111`. 62 engineered features | `02` D2 | DELETE | S | hydro-ml-engineer | D2 decision | **G8.** Evidence that the D2 training pipeline lost time entirely |
| DI-029 | `ml-service/data/floodgauges_dummy.json`, `rainfall_dummy.json` | 0 bytes each. Described as "simulated" in `documentation/FEATURES.md:684-686` | none | DELETE | S | data-ingestion-engineer | none | **G5** (intent) |
| DI-030 | CCTV demo assets | `public/videos/cctv/cctv_{karet,katulampa,manggarai,sunter}.mp4`. `lib/constants.ts:912-961` `CCTV_CHANNELS` has hardcoded `is_flooded` and `flood_probability` (for example Manggarai 0.95), used by `app/cctv-simulation/page.tsx:7-20` | `04` S12; `10` #5 | PARK | S | operator-ui | DI-015 | **G5.** Allowed only behind `NOAH_DEMO_MODE=true` with a "SIMULASI" label, and excluded from M1 |

### C. Seeds, scripts, Supabase housekeeping

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| DI-031 | `scripts/seed-regions.mjs` (D10) | `:8` hardcodes the Supabase project URL. **`:9` hardcodes a Supabase JWT whose `role` claim is `service_role` (D10, which the plan put at about line 10).** `:11-105` pulls emsifa `api-wilayah-indonesia` for provinces, regencies and districts sequentially, with no throttling, and inserts null lat/lon/geometry. `villages` is never seeded. The file is in history since `9c886eb` | `03` `spatial_units`; `10` #10 | DELETE | S | platform-security (rotate, purge history), data-ingestion-engineer | none | **G10.** Rotate the key in Supabase and purge git history. emsifa has no geometry, so it cannot feed `spatial_units` |
| DI-032 | `test-supabase.js` | Stray script that reads `.env.local` and prints the Supabase URL and the first 5 provinces. No secret is printed | none | DELETE | S | platform-security | none | Hygiene |
| DI-033 | `supabase/.temp/*` tracked | `project-ref`, `pooler-url` (password segment is a bracket placeholder, so no secret), CLI and service version files | none | DELETE | S | platform-security | none | **G10** hygiene. Untrack and add to `.gitignore`. It exposes the project ref |
| DI-034 | `supabase/seed.sql` | `:4` creates `uuid-ossp`. `:30-61` duplicates the DDL of two migrations. **`:65` uses `TRUNCATE`.** `:68-72` has 3 unsourced incidents, one of them a Malang earthquake. `:75-91` has 15 fabricated alerts, including "Peringatan dini dari BMKG" (`:88`) and "warga diimbau waspada" (`:84`) | `10` #1, #5, #6 | DELETE | S | data-ingestion-engineer | none | **G1** (text impersonates official warnings), **G5, G6** (TRUNCATE pattern). Target seeds hold only configuration: stations, thresholds, event definitions |

### D. Existing Supabase tables and migrations

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| DI-035 | `evacuation_locations` (D6) | `supabase/migrations/001_initial_schema.sql:2-14`. Seeds 35 shelters nationwide at `:33-71` (Surabaya, Medan, Jayapura and others) with `last_updated = now() - interval`. The `:36-70` inserts cast `'[…]'::jsonb` into a `TEXT[]` column, which will fail. `uuid_generate_v4()` is used without the extension in the migration. `app/api/evacuation/route.ts:21-30` randomizes status and verifier per request | `02` D6 (shelters out of scope) | DELETE | S | data-ingestion-engineer | none | **G5.** D6 confirmed. Includes contact names and phones (public offices, but still personal names) |
| DI-036 | `laporan_banjir` and storage bucket `laporan-banjir` | `001_initial_schema.sql:17-29` stores citizen reports with `reporter_name` and `reporter_contact`. Anon client inserts at `app/flood-report/page.tsx:190-212`, with a public photo URL at `:195`. That insert writes `prediction_risk`/`prediction_probability`, columns that are not in the migration (schema drift). `water_level INT` receives a string enum (`lib/schemas.ts:7-13`). `:148` invents `ketinggian_air_cm = category index × 30`. Read by `app/api/flood-reports/route.ts:14-17`, `app/sensor-data/page.tsx:21` and `components/sensor-data/FloodReportList.tsx:69` | `03` `flood_reports` (official and crowd sources only) | DELETE | S | data-ingestion-engineer, platform-security | none | **G3** (citizen personal data, public photo URLs), **G5, G8.** Purge live rows and storage objects after export for the record (Q8) |
| DI-037 | `predictions` | `20250309000000_create_predictions_detections.sql:2-13`: `prediction_cm` and `water_level_cm` as FLOAT, `region_id` defaulting to `MANGGARAI_01`, risk enum `AMAN…CRITICAL`, public SELECT `:39`, permissive INSERT `:43`. No code writes to it. No append-only guard | `03` `forecasts` (append-only, immutable); `05` | REBUILD | S | data-ingestion-engineer, evaluation-engineer | DI-044 | **G6.** Replace with `forecasts`, which carries `source`, `model_version`, `issued_at`, `lead_min`, `valid_from`/`valid_to`, `threshold_def`, and a trigger that rejects UPDATE/DELETE |
| DI-038 | `detections` | Same migration `:20-30`, holding YOLO results with lat/lon. Public SELECT `:40`. Never written | `04` S12; `03` `flood_reports(source=cctv)` | PARK | S | data-ingestion-engineer | DI-015 | Fold into the CCTV connector design when S12 is granted |
| DI-039 | `sms_subscribers`, `sms_logs` | `20250309100000_create_sms_subscribers.sql:6-31` stores plaintext `phone_number` for residents ("Warga"). Anon INSERT `:44-45`, **anon SELECT on all subscribers `:48-49`, and anon SELECT on all logs `:60-61`**, which exposes every phone number and message. Written by `app/api/sms-alert/route.ts:114`, `:164`, `:179` and `app/api/sms-subscribe/route.ts` | `10` #1, #3; `03` `users.phone_hash` | DELETE | S | platform-security | none | **G1, G3.** Public alerting and public PII. Export, then purge the live table. Operator contacts move to `users` with hashed or encrypted phones |
| DI-040 | `historical_incidents` | `20250818100000_create_historical_incidents_table.sql:16-33`, seeded by `seed.sql:68-72`, read by `app/api/statistics/incidents/route.ts:14` | `03` `flood_reports` (S4 archive) | DELETE | S | data-ingestion-engineer | none | **G5, G7.** Unsourced figures (losses, casualties) |
| DI-041 | `alerts` | `20250818110000_create_alerts_table.sql:4-21` (CREATE TYPE has no guard, so it clashes with `seed.sql:19-28`). Seeded with fabricated rows (`seed.sql:75-91`). Read by `app/api/alerts/route.ts:14` and shown through `components/contexts/AlertCountContext.tsx:67` | `03` `recommendations` (operator only) | DELETE | S | data-ingestion-engineer | none | **G1, G5** |
| DI-042 | `provinces`, `regencies`, `districts`, `villages`, `user_preferences` | **No migration in the repo**; they were created out of band. Used at `lib/api.server.ts:30-52`, `app/api/regions/route.ts`, `app/api/health/route.ts:21`, `app/api/preferences/route.ts:18-73` | `02` (34-province selector out of scope); `03` `spatial_units` | DELETE | S | data-ingestion-engineer | DI-044 | Schema not reproducible from the repo. Kemendagri `village_code` could become `spatial_units.code` for kelurahan, but geometry must come from an authoritative source (S14 or Jakarta Satu) |
| DI-043 | Migration set hygiene | No PostGIS. `uuid-ossp` only in `seed.sql`. Mixed naming (`001_…` alongside timestamps). Unguarded `CREATE TYPE`. A migration will fail (DI-035). No append-only triggers | `03` Store | REBUILD | S | data-ingestion-engineer | none | Start a clean migration chain for the target schema. Keep the old migrations only until DELETE rows are executed |

### E. Target data model and connectors (not found, NEW)

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| DI-044 | Schema baseline, PostGIS | not found | `03` Store, Data model | NEW | M | data-ingestion-engineer | managed PG choice (Q8) | `CREATE EXTENSION postgis`. Append-only triggers on observations, pump_states, flood_reports, forecasts and verifications. `supersedes_id` for corrections. **G6, G8** |
| DI-045 | `spatial_units` | not found (only `FLOOD_ZONES_MOCK`, DI-006) | `03` Data model | NEW | M | data-ingestion-engineer | DI-044; S8/S14 geometry | polder, kelurahan, RT and RW with parent links. Lighthouse polders digitized manually if S8 is delayed |
| DI-046 | `stations` and station configuration | not found. Station identity today is the string `MANGGARAI_01` (`app/api/water-level/route.ts:78`, migrations) and the CCTV list in `lib/constants.ts:912-961` | `03` Data model; `04` connector rules (D12) | NEW | S | data-ingestion-engineer | DI-044 | About 38 S1 posts with `external_id`, `datum_note`, `unit='cm'`, and `siaga_thresholds` jsonb from DSDA's table (Manggarai 750/850/950). Seed coordinates from `tma_2020.xlsx.csv` and verify |
| DI-047 | `observations` | not found | `03` Data model | NEW | S | data-ingestion-engineer | DI-044, DI-046 | `(station_id, ts, value, unit, quality_flag, ingested_at, raw_ref)`, append-only, unique on `(station_id, ts, raw_ref)` to keep re-polls idempotent without updates. **G6, G7, G8** |
| DI-048 | `pumps` | not found (mock pumps `lib/mock-data.ts:49-66`) | `03` Data model; `04` S7 | NEW | S | data-ingestion-engineer | DI-044, DI-045 | `capacity_m3s`. Seed from S7 aggregates plus manual entry for lighthouse polders. Store L/s inputs converted at the edge. **G8** |
| DI-049 | `pump_states` and S6 simulator | not found | `03` Data model; `04` S6; `07` "Before SCADA access" | NEW | M | data-ingestion-engineer, hydro-ml-engineer | DI-048 | Read-only. **G2:** no write path to SCADA. Simulator rows carry `source='simulator'`, show "SIMULASI", and are excluded from M1. **G5** |
| DI-050 | `rain_products` and object storage | not found | `03` Data model, Store | NEW | M | data-ingestion-engineer | DI-044, bucket | Rasters and images in S3-compatible storage. Rows hold `issued_at`, `valid_at`, `kind`, `uri`. **G14** (about 2 TB budget) |
| DI-051 | `flood_reports` | not found (citizen `laporan_banjir` is not this, DI-036) | `03` Data model; `04` S4, S15, S12 | NEW | S | data-ingestion-engineer | DI-044, DI-045 | RT-level, append-only, `source` enum. **G3, G6** |
| DI-052 | `forecasts` | not found (see DI-037) | `03` Data model; `05` | NEW | S | data-ingestion-engineer, evaluation-engineer | DI-044 | Immutable via trigger. DSDA Siaga and baseline logged as forecast sources. **G6, G9** |
| DI-053 | `event_definitions` | not found | `03` Data model; `05` | NEW | S | evaluation-engineer | DI-044 | Versioned rule jsonb |
| DI-054 | `verifications` | not found | `03` Data model; `05` | NEW | S | evaluation-engineer | DI-052, DI-053 | Append-only. **G6** |
| DI-055 | `recommendations` | not found | `03` Data model; `06`, `07` | NEW | S | backend-engineer | DI-052 | Operator-only channel. **G1, G16, G17** |
| DI-056 | `users`, `audit_log` | not found (`user_preferences` has no schema, DI-042) | `03` Data model; `08` | NEW | S | backend-engineer, platform-security | DI-044 | `phone_hash`, encrypted contact, OIDC subject. **G3** |
| DI-057 | Connector framework | not found. All current calls are request-time proxies inside Next.js routes or the browser | `03` Connectors; `04` rules | NEW | M | data-ingestion-engineer | DI-044, DI-050 | Python workers on APScheduler, one module per source, isolated failure, exponential backoff, identified User-Agent, conditional GET, raw payload to object storage, `ingested_at` and `raw_ref`, range checks to `quality_flag`. **G4, G7, G8, G12** |
| DI-058 | Historical archive import (S2, S3) | Partial: only `tma_2020.xlsx.csv` (DI-026). No downloader for data.jakarta.go.id | `04` S2, S3 | NEW | M | data-ingestion-engineer | DI-047 | S2 from 2018 to 2020 now. S3 (5-min TMA and 55 ARR, 2020 to 2026) within 5 working days of access (`09` W4 to W6) |
| DI-059 | Geodata sources (S9 DEM, S11 subsidence, S14 exposure) | not found. Only ArcGIS `World_Topo_Map` basemap tiles (`components/map/FloodMap.tsx:331`, `lib/constants.ts:117`) and invented `population` fields (`lib/constants.ts:364`, `:380`; `seed.sql` `estimated_population`) | `04` S9, S11, S14; `03` Geo pipeline | NEW | M | data-ingestion-engineer (download, provenance), hydro-ml-engineer (processing) | DI-045, DI-050 | Download `jkt_20m` from the BPBD GeoNode, InSAR rates from the publication data, BPS/Jakarta Satu exposure per kelurahan/RW. Record licences. **G13** |
| DI-060 | Drainage and polder boundaries (S8), pump inventory (S7) | not found | `04` S7, S8 | NEW | M | data-ingestion-engineer | DI-045, DI-048 | Manual entry forms or CSV loaders for lighthouse polders until the agreements arrive. Never invent capacities; record a gap instead |
| DI-061 | Parser fixtures and tests | not found. `lib/utils.test.ts` only; CI does not run tests (D9) | `10` #11; `04` rules | NEW | S | data-ingestion-engineer, qa-verifier | DI-057 | Saved S1/S4/S15 payloads as fixtures. Unit and time normalization tests (mm to cm, WIB to UTC, duplicate ts, negative datum) using `tma_2020.xlsx.csv` samples |
| DI-062 | JaWaRA (S16), Google Flood Hub (S17) | not found | `04` S16, S17 | PARK | S | data-ingestion-engineer | access | S16 is closed, so exclude it from M1 until accessible. S17 is log-only as `forecasts(source=floodhub)` if retrievable, and never an M2 input |

## S1 to S17 coverage

| # | Source | Status in repo | Evidence |
|---|---|---|---|
| S1 | Posko Banjir DSDA (TMA, about 38 posts) | **not found** | No request to `poskobanjir.dsdadki.web.id` anywhere. D1 replays CSV instead (DI-001) |
| S2 | Open Data Jakarta TMA 2018 to 2020 | **partial** | `ml-service/data/tma_2020.xlsx.csv` (40 days, 21 posts, mm). No downloader, undocumented provenance (DI-026, DI-058) |
| S3 | DSDA archive TMA and 55 ARR, 2020 to 2026 | **not found** | n/a (REQUESTED) |
| S4 | BPBD Info Banjir | **not found** | Only the UI toggle `FloodMap.tsx:405` with the layer commented out at `:820` (DI-007) |
| S5 | BMKG nowcast | **not found** | Commented-out unverified tile URL in `PetaBanjirClient.tsx:313`. RainViewer and OWM used as unofficial substitutes (DI-008, DI-009, DI-003) |
| S6 | SCADA pump houses | **not found** | Random pumps `lib/mock-data.ts:49-66`. `/api/pump-status` is missing (DI-018, DI-049) |
| S7 | Pump inventory | **not found** | Random names and conditions only. The `PumpData` L/s field is never populated (DI-048) |
| S8 | Drainage network, polder boundaries | **not found** | Only an Overpass OSM waterway query `lib/api.client.ts:39-97` (DI-013) |
| S9 | DEM 20 m (BPBD GeoNode) | **not found** | Only raster topo basemap tiles (DI-059) |
| S10 | LiDAR native | **not found** | n/a (CLOSED) |
| S11 | Subsidence (InSAR) | **not found** | n/a (DI-059) |
| S12 | CCTV (118 cameras) | **partial** | `app/api/cctv-scan/route.ts` and the Roboflow path. No real feed: hardcoded `CCTV_CHANNELS`, local mp4 files (DI-015, DI-030) |
| S13 | Katulampa, Depok, Manggarai | **not found** (live) | Present only historically in `tma_2020.xlsx.csv`. Arrives via S1 |
| S14 | Population and buildings | **not found** | Invented `population` and `estimated_population` values (DI-059) |
| S15 | PetaBencana.id | **partial** | Live passthrough `app/api/disaster-proxy/route.ts:21`, not stored, chatbot-only. Map uses a mock (DI-004, DI-006) |
| S16 | JaWaRA | **not found** | n/a (CLOSED) |
| S17 | Google Flood Hub | **not found** | n/a |

Out-of-scope external hosts found (none in S1 to S17): OpenWeatherMap (data, tiles, geocoding), WAQI and aqicn tiles, RainViewer, BMKG autogempa, Overpass, Nominatim, emsifa, Roboflow, Gemini, Twilio, Upstash, CartoDB/OSM/ArcGIS basemaps, unpkg (Leaflet assets), placehold.co (`app/flood-map/page.tsx:80`, `:92`, `:114`).

## Timestamps and time zones (where created or parsed)

| Location | Behaviour | Problem |
|---|---|---|
| `app/api/water-level/route.ts:48-50`, `app/api/sensor-simulator/route.ts:50-51`, `:69-72` | `getHours()`, `getDate()`, `getMinutes()` on server time | Result depends on host TZ (UTC on Vercel, WIB on a dev laptop) |
| `app/api/water-level/route.ts:74`, `:92`; `app/api/sensor-simulator/route.ts:56`, `:93`; `app/api/rainfall-dual/route.ts:64` | `new Date().toISOString()` used as the observation time | **G7:** the reading time is falsified (2020 data or OWM `dt` replaced by now) |
| `app/api/water-level/route.ts:32`, `:80` | `original_timestamp` passed as a naive string `2020-01-01 00:00:00` | No zone |
| `app/api/air-quality/route.ts:28` | Hardcoded `tz: '+07:00'` on a canned response | Fake |
| `app/api/weather-history/route.ts:8-9`, `:43` | Unix seconds passed through | OK as UTC, but only `start` is used |
| `lib/mock-data.ts:42`, `:63` | Random times in the last 1 to 2 h, one as ISO and one as epoch ms | Mixed types, fake |
| `lib/constants.ts:365`, `:381`, `:392`, `:400-642` | `new Date()` or `Date.now() - offset` at module load | Fake freshness |
| `app/api/cctv-scan/route.ts:70`, `app/api/smart-alert/route.ts:118`, `app/api/health/route.ts:11`, `:47`, `app/api/ai-alerts/route.ts:339` | `now()` as processing time | Acceptable as `computed_at` only |
| `app/flood-report/page.tsx:190` | `Date.now()` in the storage file name | n/a |
| All migrations | `TIMESTAMPTZ DEFAULT now()` | Correct (UTC). Target keeps `timestamptz` |
| `ml-service/src/preprocessing.py:72`, `:111` | `pd.to_datetime` with no zone | Naive. `preprocessed_data.csv` ended up with every row at 1970-01-01 |
| `tma_2020.xlsx.csv`, `DATASET_FINAL_TRAINING.csv` | Naive local times (assumed WIB) | Must be localized as `Asia/Jakarta` before converting to UTC (Q11) |
| `hujan_bogor2022.csv` | Naive ISO without offset | Zone unknown (Q10) |
| UI display | 37 `toLocale*String` calls in `app/`, `components/`, `lib/`, `hooks/`, none with `timeZone`. "WIB" is hardcoded next to times at `components/map/TimelineScrubber.tsx:207`, `components/tiling/BottomTile.tsx:756`, `components/tiling/LeftTile.tsx:77` | **G8:** the label says WIB, but the time shown is in the browser's zone |

## Units assumed (cm vs m, mm vs mm/h)

| Location | Assumed | Actual or problem |
|---|---|---|
| `ml-service/data/DATASET_FINAL_TRAINING.csv` `tma_manggarai`, used by `app/api/water-level/route.ts:93` and `app/api/sensor-simulator/route.ts:94` as `water_level_cm` | cm | **dm** (55 to 97). Every displayed or derived "cm" value is 10x low. Thresholds 400/700/850 never fire |
| `ml-service/data/tma_2020.xlsx.csv` `tinggi_air` | not declared | **mm** (Siaga transitions at 7500/8510/9520 for Manggarai) |
| `lib/mock-data.ts:30-41` | `unit: 'm'` | Metres, while the rest of the app assumes cm |
| `components/tiling/FloodRiskForecast.tsx:115-116` | "> 50 means cm, else m × 100" | Heuristic unit guessing |
| `lib/api.ts:111` `kapasitas_liter_per_detik` | L/s | Target is m3/s |
| `app/flood-report/page.tsx:146-148` | `ketinggian_air_cm = category index × 30` | Invented conversion |
| `supabase/migrations/001_initial_schema.sql:22` `water_level INT` | number | Receives the string enum from `lib/schemas.ts:7-13` |
| `app/api/rainfall-dual/route.ts:48-49`; `app/api/weather-history/route.ts:44` | mm | OWM `rain.1h` = mm accumulated over the last hour. Missing is coerced to 0 |
| `ml-service/src/main.py:75-76` (`water_level_cm`, `rainfall_mm`) | cm, mm | Rain could be a 1 h accumulation or a rate. With DI-001 the "cm" input is really dm |
| `ml-service/src/metrics.py:64-65` | cm | Thresholds 150/100 contradict 750/850/950 |
| `supabase/seed.sql:77-90` | Free-text "cm" values and Siaga labels | 850 cm is labelled Siaga 3 (wrong) |

## Replayed or fake data: confirmation of D1, D7, D12

- **D1 confirmed.** `app/api/water-level/route.ts:20-53` (load and replay index) and `:74`/`:92` (stamped now). The CSV path is `ml-service/data/DATASET_FINAL_TRAINING.csv` (January 2020, hourly, 744 rows). Also new: the unit mislabel (dm as cm). The same replay is duplicated in `app/api/sensor-simulator/route.ts:68-103`.
- **D7 confirmed.** `lib/constants.ts:351-384` (two rectangles), rendered at `components/map/FloodMap.tsx:406` and `:855`. PetaBencana is never drawn on any map.
- **D12 confirmed and extended.** 400/700/850 at five sites, 150/100 in `metrics.py`, inverted severity order in two UI files, and a wrong label in the seed (see DI-021). The repository's own `tma_2020.xlsx.csv` corroborates 750/850/950 cm for Manggarai.
- Other fake-data paths in the ingestion domain: DI-002, DI-003 (missing becomes 0), DI-005, DI-011, DI-016 (300 cm default), DI-019, DI-020, DI-030, DI-034. Outside this domain and noted only: `app/api/ai-alerts/route.ts:258-281` (`Math.random()` statistics) and the fabricated headlines in `components/tiling/BottomTile.tsx:654-714`, which belong to the backend and UI agents.

## Guardrail violations (ingestion domain)

| G# | Where | Rows |
|---|---|---|
| 1 No public warnings | Public SMS chain `app/api/smart-alert/route.ts:120-139` to `sms_subscribers`. Seeded alerts impersonating BMKG/official warnings `supabase/seed.sql:75-91` | DI-016, DI-034, DI-039, DI-041 |
| 3 Personal data | `laporan_banjir.reporter_name`/`reporter_contact` plus a public photo bucket. `sms_subscribers`/`sms_logs` phone numbers readable by anon | DI-036, DI-039 |
| 5 No fake data | D1 replay, simulator `Math.random()`, mock dashboard, mock flood zones, canned AQI, stub PetaBencana, 300 cm default, zero-filled rain, seeded alerts and incidents | DI-001 to DI-006, DI-011, DI-016, DI-019, DI-020, DI-030, DI-034, DI-040, DI-041 |
| 6 Append-only | No append-only guard on any table. `seed.sql:65` uses TRUNCATE | DI-034, DI-037, DI-043 |
| 7 Provenance | Observation time replaced by now(). `source` values exist only in JSON and are never stored. No `raw_ref` | DI-001, DI-003, DI-024 |
| 8 Units and time | dm labelled as cm, mm, m and L/s mixed, server-local time indexing, no WIB formatting | DI-001, DI-019, DI-020, DI-024, DI-025 to DI-028 |
| 10 Secrets | Supabase `service_role` JWT at `scripts/seed-regions.mjs:9` (D10). Roboflow key at `ml-service/src/yolo_model.py:48` (D11). OWM keys shipped to the browser via `NEXT_PUBLIC_*` | DI-010, DI-015, DI-031 |
| 12 Observability | No connector freshness or stale alert | DI-022 |
| 13 Licensing | Overpass/OSM ODbL and RainViewer terms unrecorded | DI-009, DI-013 |
| 14 Budget | OWM One Call 3.0 (paid) in `weather-history` | DI-010 |

## Plan (ingestion work, in roadmap order)

**W1 (guardrails first):**
1. platform-security rotates and purges the Supabase service_role key (DI-031) and the Roboflow key (DI-015). Untrack `supabase/.temp` (DI-033).
2. Delete or flag the fake data paths: DI-002, DI-005, DI-011, DI-025 from runtime, DI-029, DI-034. Cut the public SMS chain (DI-016, DI-039).
3. Create a clean migration chain with PostGIS and the 14 target tables plus append-only triggers (DI-043, DI-044 to DI-056). Export, then drop, the public tables (DI-035, DI-036, DI-039 to DI-042).
4. Build the connector framework (DI-057) and object storage bucket (DI-050).
5. Load station configuration with DSDA Siaga thresholds (DI-046, DI-021) and cross-check them against `tma_2020.xlsx.csv`.
6. Connectors **S1** (DI-001), **S4** (DI-007), **S5 images** (DI-008) and **S15** (DI-004) record to the store. The Open-Meteo fallback (DI-003) is labelled as fallback.
7. Per-connector health and stale alert at 15 min (DI-022). Parser fixtures and tests in CI (DI-061).
8. Import the `tma_2020.xlsx.csv` S2 archive (DI-026) and start the S2 downloader (DI-058).

**W2:** S9/S11/S14 downloads with provenance (DI-059). Lighthouse polder geometry into `spatial_units` (DI-045, DI-060). Replace mock dashboard and forecast data with store reads (DI-019, DI-020, DI-006).

**W3:** `pumps` from inventory (DI-048), plus `pump_states` in simulator mode labelled SIMULASI (DI-049).

**W4 to W6:** Integrate S3, S6, S7, S8 and S12 within 5 working days of each grant (DI-058, DI-049, DI-060, DI-015).

## Open questions

| # | Question | Who can answer |
|---|---|---|
| Q1 | Where did `tma_2020.xlsx.csv` and `DATASET_FINAL_TRAINING.csv` come from (Open Data Jakarta S2 or a scrape of S1)? Under what licence? How were the rain columns produced? | Ari |
| Q2 | In what unit does the DSDA public table or XML report `tinggi_air` (mm or cm)? The 2020 file is mm | DSDA |
| Q3 | What is the exact undocumented XML endpoint URL for Posko Banjir, what polling rate is acceptable, and what is the status of the formal permission? | DSDA |
| Q4 | BPBD Info Banjir: what RT code scheme, what is the definition of start and end time, and how does archive access work? | BPBD |
| Q5 | BMKG nowcast: what is the stable public image URL and update cadence, and when will the research data agreement land? | BMKG |
| Q6 | PetaBencana: which API host is current (`api.petabencana.id` or another), what are the terms and rate limits, and is DKI filtering supported server-side? | Ari / Yayasan Peta Bencana |
| Q7 | Station datums: why are there negative values at Pluit, Cideng and Cibalok? What is DSDA's official per-post threshold table? | DSDA |
| Q8 | Does the target store stay on the current Supabase project, or move to another managed Postgres with PostGIS? Do the live tables (`laporan_banjir`, `sms_subscribers`, storage bucket) contain real citizen data that must be purged? | Ari |
| Q9 | Keep the RainViewer overlay as visual context (licence and coverage check) or drop it? | Ari |
| Q10 | What is the source of `hujan_bogor2022.csv` (Open-Meteo archive?) and its time zone? | Ari |
| Q11 | Are the 2020 CSV timestamps WIB? | Ari / DSDA |
| Q12 | The region tables and `user_preferences` were created outside migrations. Should their live schema be exported before deletion? | Ari |
