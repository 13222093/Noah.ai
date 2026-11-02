# 02. Current state and audit checklist

## What the repository is known to contain (verify everything)
About 39k lines. Line numbers below come from a review in September 2026 and may have drifted; locate by content if they do not match.

### Working and potentially reusable
- Next.js 16 app with a Leaflet map stack: CartoDB/OSM/ArcGIS basemaps, RainViewer radar, OpenWeatherMap tiles, AQI, OSM flood-prone and waterway overlays via Overpass, region selector for 34 provinces (Supabase).
- 35 evacuation shelters in Supabase with OSRM routing.
- Gemini 2.5 Flash chatbot with 8 function-calling tools (weather, BMKG earthquake, PetaBencana, geocoding, water level, and others).
- Twilio SMS alert pipeline with subscriber table and logs.
- FastAPI ML service, Docker Compose, Sentry, PWA, EN/ID i18n, CI running typecheck and build.

### Known defects (must be confirmed and classified)
| # | Area | What it looks like | What it actually is | Expected decision |
|---|---|---|---|---|
| D1 | `water-level/route.ts` (around lines 46 to 53) | "LIVE" Manggarai water level | Replay of a January 2020 CSV indexed by wall clock and stamped with now() | REBUILD as real ingestion from Posko Banjir DSDA |
| D2 | `main.py` (around line 171) | LSTM forecast | Trained on 62 engineered features, served with 3 (Jakarta rain duplicated, Bogor dropped); almost certainly throws and falls back. Shipped metrics R2 = -0.41, flood recall 0 of 9 events (`training_results.json`, around lines 19 to 37) | DELETE the model; REBUILD forecasting per `06_MODULE_2_IMPACT_NOWCAST.md` |
| D3 | `main.py` (around lines 183 to 214) | "Physics engine" | water + 0.8 * rain_bogor + 0.5 * rain_jkt, clamped; uncalibrated | DELETE |
| D4 | `main.py` (around lines 98 to 146) | Demo mode | "GOD MODE" returns a canned 1100 cm / CRITICAL globally | DELETE from production; PARK behind a dev-only flag if useful for UI tests |
| D5 | `mock-data.ts`, used unconditionally in `dashboard/page.tsx` (around lines 30 to 31) | Dashboard stats, pumps, people at risk | `Math.random()` | REBUILD from real data |
| D6 | `evacuation/route.ts` (around lines 21 to 30) | Shelter operational status | Randomized every request | DELETE or PARK (shelters are out of scope) |
| D7 | Flood zones layer | PetaBencana crowd data | Two hardcoded squares | REBUILD as real PetaBencana and BPBD layers or DELETE |
| D8 | Elevation, contours, drainage, gates | n/a | Nothing exists except raster topo basemap tiles | NEW per `03` and `06` |
| D9 | Tests | n/a | 4 assertions; CI never runs them | REBUILD test strategy; CI must run tests |
| D10 | `seed-regions.mjs` (around line 10) | Seed script | **Supabase service_role JWT committed** | Rotate key, remove from code and history, move to env |
| D11 | `yolo_model.py` (around line 48) | CV model loader | **Roboflow API key committed** | Rotate key, move to env |
| D12 | Siaga thresholds in code | 400 / 700 / 850 | Official Manggarai thresholds are Siaga 3 above 750 cm, Siaga 2 above 850 cm, Siaga 1 above 950 cm | REFACTOR into per-station configuration from an authoritative table |

## Audit checklist for agents
For every top-level directory and every feature, answer:
1. What does it do, and does it run?
2. Which plan section needs it? If none, propose DELETE or PARK.
3. Does it use fake, random, replayed, or hardcoded data in a production path? (Guardrail 3)
4. Does it send anything to the public? (Guardrail 1)
5. Does it contain secrets? (Guardrail 5)
6. Does it have tests that CI runs?
7. Can it be reused for the target with a REFACTOR, or is it cheaper to REBUILD?

Additional items to inventory explicitly:
- Every external API call: host, key handling, rate limits, whether it is in scope (see `04_DATA_SOURCES.md`).
- Every Supabase table and migration; whether it maps to the target data model in `03_TARGET_ARCHITECTURE.md`.
- Every place a timestamp is created or parsed (timezone handling).
- Every place units are assumed (cm vs m, mm vs mm/h).
- The FastAPI service: endpoints, model files, dependencies, Dockerfile.
- The chatbot: tools, prompts, whether any tool fabricates data; whether it is worth reusing as an operator assistant (CITYA-style) or should be PARKED.
- The Twilio pipeline: must not send to the public; decide REBUILD as an operator WhatsApp channel or DELETE.

## Likely outcome (hypothesis, to be confirmed by the audit)
Keep the Next.js shell, map components, i18n, Docker, Sentry, and CI skeleton. Delete or park everything public-facing (shelters, routing, citizen SMS, 34-province selector, general weather layers). Delete the forecast core. Build new: ingestion, data model, three modules, operator dashboard, role-based access, evaluation reports.
