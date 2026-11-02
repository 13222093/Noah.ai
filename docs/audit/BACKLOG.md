# Noah AI: backlog (Phase A output)

This backlog comes from `docs/audit/GAP_REPORT.md` and uses the format in `docs/plan/11_GAP_ANALYSIS_TEMPLATE.md`. It is grouped by roadmap week (`docs/plan/09_ROADMAP_AND_ACCEPTANCE.md`), and items within a week are ordered by dependency.

Some markers appear on items:
- **Human step (Ari)** means a person with dashboard or admin access must act. Agents prepare the change and never perform it alone.
- **Needs approval** means the agent must not proceed until Ari approves in chat.
- **Blocked** means the item waits on external data access.

No item may break `10_GUARDRAILS.md` or the non-goals in `01_PRODUCT_BRIEF.md`:
- no public alerts;
- no writes to SCADA, pumps or gates;
- no national coverage;
- no deep-learning nowcast built from scratch;
- ask before adding any paid service.

Item counts: W1 43, W2 19, W3 16, W4 to W6 11, W7 to W8 6, W9 4 (99 in total).

---

## W1: clean foundation and data flowing

### 1. Secrets (guardrail 10)
- [ ] B-001 (W1, platform-security-engineer, S) Supabase service_role key (D10): Ari rotates it, the agent removes it from code, moves it to an env var and adds secret scanning
      **Human step (Ari).** Roll the Supabase JWT secret, or switch to new API keys, in the Supabase dashboard. This also changes the anon key, so update the Vercel, local and future VPS envs.
      Agent tasks:
      - Delete `scripts/seed-regions.mjs`, which is out of scope and holds the key.
      - Make every Supabase client read `SUPABASE_SERVICE_ROLE_KEY` from env only and fail closed when it is missing.
      - Add a gitleaks rule for Supabase JWTs.
      Done when:
      - Ari confirms the old key is rejected.
      - No JWT literal remains in the tree.
      - Supabase logs since 2026-03-12 have been reviewed, and the finding is recorded in `docs/audit/`.
      Refs: G-001, G-017, 02_CURRENT_STATE_AND_AUDIT.md D10, 09_ROADMAP_AND_ACCEPTANCE.md W1, 10_GUARDRAILS.md #10
- [ ] B-002 (W1, platform-security-engineer, S) Roboflow key (D11): Ari rotates it, the agent removes it from code, moves it to an env var and adds secret scanning
      **Human step (Ari).** Revoke the key in the Roboflow workspace.
      Agent tasks:
      - Delete the hardcoded fallback at `ml-service/src/yolo_model.py:48`. The whole CV path goes in B-018.
      - Remove `ROBOFLOW_API_KEY` from `docker-compose.yml`.
      - Add a gitleaks rule.
      Done when: the key is revoked, no literal remains in the tree, and `ROBOFLOW_API_KEY` no longer appears in compose.
      Refs: G-002, G-076, 02_CURRENT_STATE_AND_AUDIT.md D11, 10_GUARDRAILS.md #10 #14
- [ ] B-003 (W1, platform-security-engineer, S) OpenWeatherMap keys: Ari rotates them, the agent removes them from code, moves them to an env var and adds secret scanning
      **Human step (Ari).** Revoke the key committed in history (`app/api/chatbot/route.ts:38`, `5f0fa0e`). Rotate the current key, which has been shipped to browsers.
      Agent tasks:
      - Remove every `NEXT_PUBLIC_OPENWEATHER*` read (this lands together with B-022).
      - Collapse the four OWM env names. If OWM goes entirely (B-027), drop the variable.
      Done when: no `NEXT_PUBLIC_OPENWEATHER*` remains in code or in the built bundle, and both keys are revoked.
      Refs: G-003, G-004, 10_GUARDRAILS.md #10
- [ ] B-004 (W1, platform-security-engineer, S) Secret scanning in pre-commit and CI
      Agent tasks:
      - Add a `.pre-commit-config.yaml` with gitleaks (MIT).
      - Add a CI job that scans the full history and fails on any detection.
      - Add an allowlist for Workbox revision hashes in `public/sw.js`.
      **Human step (Ari):** enable GitHub secret scanning and push protection in the repository settings.
      Done when: a planted test secret fails both the hook and CI, and the push protection setting is on.
      Refs: G-006, 10_GUARDRAILS.md #10
- [ ] B-005 (W1, platform-security-engineer, S) Env hygiene and committed CLI cache
      Agent tasks:
      - Untrack `supabase/.temp/` and add it to `.gitignore`.
      - Replace the dev DB password in `.env.example:15` with a placeholder. **Ari** rotates it if it was ever reused.
      - Delete unused variables.
      - Add a validated env schema: zod for Next.js, pydantic-settings for Python.
      - Delete `test-supabase.js`.
      - Remove the stale second Supabase image host from `next.config.js:30-35`, after Ari confirms which project is live.
      Done when: the app refuses to start when a required var is missing, and `git ls-files supabase/.temp` returns nothing.
      Refs: G-007, G-109, G-134, 10_GUARDRAILS.md #10
- [ ] B-006 (W1, platform-security-engineer, M) Git history rewrite and force-push of `origin`
      **Needs approval.** Ari must explicitly approve the rewrite, the force-push, and what to do with the `fork` remote.
      Depends on: B-001, B-002 and B-003 being rotated, and B-004.
      Agent tasks:
      - Run `git filter-repo` with a replace-text file covering the three secrets, and drop `supabase/.temp/` from history.
      - After approval, force-push.
      - Ask GitHub to purge cached views, and tell collaborators to re-clone.
      Done when: a gitleaks full-history scan on a fresh clone is clean, and the approval is recorded.
      Refs: G-005, 10_GUARDRAILS.md #10

### 2. Public alert paths (guardrail 1) and access
- [ ] B-007 (W1, platform-security-engineer, S) Remove the citizen SMS pipeline and the smart-alert chain
      Delete:
      - `app/api/sms-alert`, `app/api/sms-subscribe`, `app/api/smart-alert` and `app/sms-subscribe/page.tsx`;
      - the NavRail and CommandCenterView entries and the LeftTile SMS tab;
      - the `twilio` dependency;
      - the "EVAKUASI SEGERA" texts in `ml-service/src/main.py:144,225,314,374`.
      Done when:
      - those routes return 404;
      - a CI deny-list for `twilio` and `messages.create` passes;
      - no Noah code path can send to a resident;
      - a test asserts that the routes are gone.
      Refs: G-008, G-009, 01_PRODUCT_BRIEF.md non-goals, 10_GUARDRAILS.md #1 #9 #16 #17
- [ ] B-008 (W1, operator-ui-engineer, S) Remove the public alerts feed and warning-style UI
      Delete:
      - `app/api/alerts`, `app/alerts/page.tsx`, `AlertCountContext`, `PeringatanBencanaCard`;
      - the fabricated media headlines in `BottomTile.tsx:644-720`.
      Done when: no UI text says Noah issues "peringatan", and no headline is attributed to a media outlet.
      Refs: G-012, 08_ROLES_AND_ACCESS.md page 3, 10_GUARDRAILS.md #1 #5
- [ ] B-009 (W1, operator-ui-engineer, S) Remove the public site and stop public indexing
      **Human step (Ari):** decide whether the Vercel deployment and `noah.ai.id` are taken down, put behind a password, or redirected.
      Agent tasks:
      - Delete `public/*.html` (landing, about, contact, privacy, data-source, 404), the Search Console file, `public/js/landing.js`, `public/css/landing.css`, the rewrite in `next.config.js:16-23` and `app/sitemap.ts`.
      - Delete the `app/education/**`, `app/contact`, `app/privacy` and `app/data-source` pages. Move the education text to `docs/` first.
      - Add `robots: noindex` metadata.
      - Set SSR `<html lang="id">` and an operator title.
      - Disable the PWA service worker (it can show cached numbers as current).
      Done when: `/` no longer serves marketing pages, `robots` returns noindex, and the HTML `lang` is `id`.
      Refs: G-013, G-014, G-115, G-116 (SSR lang part; full i18n in B-053), G-123, 08_ROLES_AND_ACCESS.md, 10_GUARDRAILS.md #1 #7 #14 #15
- [ ] B-010 (W1, backend-api-engineer, S) Interim deny-by-default access gate (until OIDC in W3)
      Agent tasks:
      - Add a `middleware.ts` that returns 401 on `/api/*` except `/api/v1/health`, and sends pages to a placeholder `/masuk`. A shared operator credential comes from env, or a reverse-proxy basic auth; never hardcoded.
      - Stop publishing FastAPI port 8000.
      - Make `/api/health` stop returning sample rows and env flags.
      Done when: anonymous requests to every page and API route are refused (tested), and port 8000 is unreachable from outside the host.
      Refs: G-069, G-098, G-103, 08_ROLES_AND_ACCESS.md, 10_GUARDRAILS.md #1 #3

### 3. Citizen PII (guardrail 3)
- [ ] B-011 (W1, platform-security-engineer, S) Lock down PII in the live Supabase project
      **Human step (Ari):** run the SQL in the Supabase dashboard, or explicitly approve an agent to run it. It changes the live DB.
      The changes:
      - Drop the anon SELECT and INSERT policies on `sms_subscribers` and `sms_logs`.
      - Enable deny-all RLS on `laporan_banjir` and `evacuation_locations`.
      - Make the bucket `laporan-banjir` private.
      - Revoke anon INSERT and public SELECT on `predictions` and `detections`.
      The agent writes the SQL as a reviewed migration plus a verification script.
      Done when: the anon key gets 0 rows or permission denied on each table, and anon reads from the bucket fail (scripted check).
      Refs: G-010, G-011, G-015, G-059, 10_GUARDRAILS.md #3 #4
- [ ] B-012 (W1, backend-api-engineer, S) Remove citizen report intake
      Delete:
      - `app/flood-report/page.tsx`, `app/api/flood-reports`, `ReportFloodModal`, `ReportFloodControl`, `FloodReportList`, `ReportEmergencyModal`;
      - the browser anon writes;
      - the local `Untitled-1.txt` and `Untitled-2.txt`, which must never be committed.
      Done when: no code path collects a citizen's name, contact or photo, and grep finds no `reporter_contact` outside the legacy migrations.
      Refs: G-011, G-134, 03_TARGET_ARCHITECTURE.md flood_reports, 10_GUARDRAILS.md #3
- [ ] B-013 (W1, platform-security-engineer, S) UU PDP purge of citizen data
      **Needs approval** from Ari, who gets guidance from Legal first.
      Depends on: B-011.
      Agent tasks:
      - Record row counts only (no contents) in a deletion log.
      - Purge `sms_subscribers`, `sms_logs` and `laporan_banjir`, plus the bucket objects.
      - Drop those tables.
      Done when: the tables and objects are gone, the deletion log is signed off by Ari, and any notification duty Legal identifies has been handed to Ari.
      Refs: G-010, G-011, 08_ROLES_AND_ACCESS.md notes, 10_GUARDRAILS.md #3
- [ ] B-014 (W1, backend-api-engineer, S) Remove SSRF routes and open LLM proxies; park the chatbot
      Agent tasks:
      - Delete `app/api/cctv-scan`, `app/api/analysis`, `app/api/ai-alerts`, `app/api/flood-analysis` and `app/api/news-summary`.
      - Disable `app/api/chatbot` with a 410 response and hide the chat UI in RightTile, CommandCenterView and GeminiChatSection (PARK).
      Done when: no route fetches a URL taken from the request, no unauthenticated LLM call is possible, and a test covers the 410.
      Refs: G-018, G-019, G-020, 10_GUARDRAILS.md #5 #14

### 4. Fake data removed or flagged (guardrails 5, 7, 8, 9)
- [ ] B-015 (W1, platform-security-engineer, S) `NOAH_DEMO_MODE` flag, SIMULASI labelling and guardrail lint
      Agent tasks:
      - Add the `NOAH_DEMO_MODE` env flag, default false.
      - Add a global SIMULASI/DEMO banner and a per-value badge component (operator-ui-engineer).
      - Add an ESLint `no-restricted-properties` rule for `Math.random` outside `tests/` and `demo/`, and a ruff rule for `np.random`.
      - Add a CI deny-list for `twilio`, `messages.create`, Modbus/OPC-UA/SCADA write libraries and `ultralytics`.
      - Replace the `Math.random` nonce in `src/lib/rateLimiter.ts:22` with `crypto.randomUUID`.
      Done when: lint fails on a new `Math.random` in production code, and the banner appears whenever the flag is on.
      Refs: G-113, G-114, 10_GUARDRAILS.md #2 #5
- [ ] B-016 (W1, data-ingestion-engineer, S) Remove the D1 replay and its siblings
      Agent tasks:
      - Delete the replay in `app/api/water-level/route.ts`, all of `app/api/sensor-simulator`, `SensorSimulatorChart`'s data source, `hooks/useWaterLevelData.ts` and `app/api/rainfall-dual`. The last one coerces missing rain to 0 and stamps `now()`; it is replaced in B-044.
      - Remove `ml-service/data/DATASET_FINAL_TRAINING.csv` (decimetres served as cm), `floodgauges_dummy.json` and `rainfall_dummy.json` from git and from the runtime.
      - Make consumers show "Belum ada data" until B-036 lands.
      Done when: no endpoint returns a historical value with a current timestamp, and grep for `DATASET_FINAL_TRAINING` returns nothing.
      Refs: G-037, G-038, G-044, G-026, 02_CURRENT_STATE_AND_AUDIT.md D1, 10_GUARDRAILS.md #5 #7 #8
- [ ] B-017 (W1, hydro-ml-engineer, M) Remove the forecast core (D2 to D4) and the dishonest metrics
      Delete:
      - the LSTM `.h5` and `.pkl` artifacts and `lstm_model.py`;
      - the "physics engine";
      - GOD MODE, `/admin/*` and `scenarios.py`, plus the Next proxies `app/api/scenarios/**`;
      - the FastAPI `/predict` and `/predict/scenario`;
      - `app/flood-predict/page.tsx`, `PredictionLayer.tsx` and `hooks/usePredictionData.ts`;
      - `metrics.py`, `training_results.json`, `training_accuracy_plot.png`, `preprocessed_data.csv` and `preprocessing.py`. Their evidence is already quoted in GAP_REPORT section 4.
      Also: make `app/api/predict` return 410 until the v1 API exists, and remove TensorFlow from `requirements.txt`.
      Done when: there is no `joblib.load` at import, no canned or fixed-timestamp response, no R2 or accuracy anywhere, and the service starts without TensorFlow.
      Refs: G-071, G-072, G-073, G-074, G-075, G-077, G-078, G-079, G-029, 02_CURRENT_STATE_AND_AUDIT.md D2 D3 D4, 10_GUARDRAILS.md #5 #7 #9 #12
- [ ] B-018 (W1, hydro-ml-engineer, S) Remove the Roboflow CV path and the AGPL artifacts
      Delete: `ml-service/src/yolo_model.py`, `/verify-visual`, `app/api/verify-visual`, `app/visual-verify/page.tsx`, the `ultralytics` import, and `ml-service/models/yolov8n.pt` and `yolo_model.pt`.
      Done when: no frame leaves the system, no AGPL code or weights remain in the core, and the CI deny-list for `ultralytics` passes.
      Refs: G-076, G-031, G-002, 04_DATA_SOURCES.md S12, 10_GUARDRAILS.md #4 #10 #12 #13 #14
- [ ] B-019 (W1, operator-ui-engineer, M) Remove the dashboard mocks (D5)
      Agent tasks:
      - Delete `lib/mock-data.ts` and the mock constants in `lib/constants.ts`. Keep the map centre, layers, breakpoints and colour tokens.
      - Delete `FloodRiskForecast.tsx`, the random `DataPanel` sparkline, `StatisticsDashboard`, the classic `CommandCenterView` and the dead dashboards.
      - Remove every "LIVE" and "Real-time" label that sits on non-live data.
      - Make `/dashboard` render explicit empty states with no numbers.
      - Fix or remove the HEAD calls to the missing `/api/flood-predict` and `/api/pump-status`.
      Done when: `/dashboard` shows no number that lacks a source, grep finds no `*_MOCK` or `generateMock*`, and B-015's lint passes.
      Refs: G-021, G-022, G-024, G-028, G-049, 02_CURRENT_STATE_AND_AUDIT.md D5, 10_GUARDRAILS.md #3 #5 #7 #8
- [ ] B-020 (W1, operator-ui-engineer, S) Remove shelters, routing and the region selector (D6)
      Delete:
      - `app/api/evacuation`, `app/evacuation`, the evacuation pins and tab;
      - both `EvacuationRouting.tsx` files, `leaflet-routing-machine`, the geolocation call;
      - `RegionDropdown`, `RegionSelector`, `useRegionData`, `LocationPickerModal` and `app/api/regions` (which has CORS `*`).
      Done when: no shelter, route or province UI remains, no user GPS goes to a third party, and no fabricated "verified_by" remains.
      Refs: G-015, G-016, G-017, 01_PRODUCT_BRIEF.md non-goals, 02_CURRENT_STATE_AND_AUDIT.md D6, 10_GUARDRAILS.md #3 #5
- [ ] B-021 (W1, operator-ui-engineer, S) Remove the remaining fake layers and pages (D7 and others)
      Delete:
      - `FLOOD_ZONES_MOCK` and its layer;
      - `app/cctv-simulation`, the CCTV mp4 files and `CCTV_CHANNELS`;
      - `app/flood-map` (mock reports and evacuation points);
      - `app/sensor-data` (fabricated reporter phones);
      - `app/statistics` and `app/api/statistics/incidents`;
      - `app/api/disaster-reports` (the stub).
      Done when: every remaining map layer and page reads only real sources or shows an empty state.
      Refs: G-023, G-025, G-026, G-027, G-030, G-036, 02_CURRENT_STATE_AND_AUDIT.md D7, 10_GUARDRAILS.md #3 #5 #7
- [ ] B-022 (W1, operator-ui-engineer, M) Remove out-of-scope layers
      Agent tasks:
      - Delete the weather, AQI, WAQI and OWM routes, pages and components, including the paid One Call 3.0 route and the canned AQI.
      - Delete the BMKG earthquake widget, Overpass, Nominatim and OWM geocoding.
      - Keep RainViewer off by default, labelled "RainViewer, bukan BMKG" if it is shown (PARK).
      Done when: no request goes to OWM, WAQI, aqicn, Overpass or Nominatim from the app.
      Refs: G-032, G-033, G-034, G-035, G-004, 01_PRODUCT_BRIEF.md non-goals, 10_GUARDRAILS.md #5 #10 #14
- [ ] B-023 (W1, evaluation-engineer, S) Remove dishonest capability claims
      Agent tasks:
      - Replace the README claims ("hybrid LSTM + physics", "high-confidence alerts", horizons) with a short notice: no validated forecast skill yet, rebuild in progress.
      - Remove the i18n strings that call a replay "live" or claim "LSTM (50%)".
      - Move `documentation/` to `docs/archive/hackathon/` with a "superseded" banner.
      Done when: grep for "LSTM", "real-time" and "akurat" in user-facing text finds only accurate statements.
      Refs: G-136, G-137, 10_GUARDRAILS.md #5 #9

### 5. CI runs tests (guardrail 11)
- [ ] B-024 (W1, platform-security-engineer, S) Make the existing tests run and scaffold module tests
      Agent tasks:
      - Fix the `vitest.config.ts` include pattern so the smoke test runs, or delete the smoke test.
      - Add a pytest scaffold (`ml-service/tests/`, `conftest.py`, pytest in dev requirements).
      - Write tests that the deleted routes stay deleted (B-007, B-014).
      Done when: `npm test` and `pytest` both run locally with at least one real test each.
      Refs: G-112, 02_CURRENT_STATE_AND_AUDIT.md D9, 10_GUARDRAILS.md #11
- [ ] B-025 (W1, platform-security-engineer, M) Full CI pipeline
      CI jobs:
      - lint (`eslint .` replaces `next lint`);
      - vitest and pytest;
      - gitleaks (from B-004);
      - guardrail checks (from B-015);
      - Docker builds of both images.
      **Human step (Ari):** make these required checks on `main` (branch protection).
      Done when: a PR that breaks any job cannot merge.
      Refs: G-111, G-106, 09_ROADMAP_AND_ACCEPTANCE.md W1 and Definition of done, 10_GUARDRAILS.md #10 #11

### 6. Platform foundation (guardrails 12, 13, 14, 8)
- [ ] B-026 (W1, platform-security-engineer, S) Dependency licence record and allowlist
      Agent tasks:
      - Generate `docs/LICENSES.md` (npm `license-checker` and `pip-licenses`) and a CycloneDX SBOM in CI, with an allowlist.
      - Raise Hippocratic-2.1 (`react-leaflet`) with Legal, and prepare a MapLibre or thin-Leaflet fallback plan.
      Done when: CI fails on a GPL or AGPL dependency in the core, and the Legal question is logged.
      Refs: G-107, G-108, 10_GUARDRAILS.md #13
- [ ] B-027 (W1, platform-security-engineer, S) Retire unbudgeted services
      **Human step (Ari):** decide which accounts to cancel (Twilio, Upstash, WAQI, Roboflow, OWM) and revoke the Gemini key.
      Agent tasks:
      - Remove `twilio`, `@google/generative-ai`, `leaflet-routing-machine` and `@upstash/redis` (after the limiter moves to local Redis/Postgres in B-045) from `package.json`.
      - Pin all versions, and move `typescript` and `tailwindcss` to devDependencies.
      Done when: the only external services in code are listed in the budget or marked "ask Ari".
      Refs: G-109, G-106, 10_GUARDRAILS.md #14
- [ ] B-028 (W1, platform-security-engineer, S) Make Sentry work
      Agent tasks:
      - Add `NEXT_PUBLIC_SENTRY_DSN` and an environment tag per stack.
      - Make `beforeSend` actually scrub PII (phones, tokens).
      - Add `sentry-sdk` to the Python service and workers, with cron monitors that alert on two failures.
      Done when: a test error from the browser, from Next.js server code and from Python arrives in Sentry free tier with PII scrubbed.
      Refs: G-110, 03_TARGET_ARCHITECTURE.md Ops, 10_GUARDRAILS.md #12
- [ ] B-029 (W1, backend-api-engineer, S) Shared time and unit utilities
      Agent tasks:
      - Add TS and Python helpers: parse source local time as `Asia/Jakarta`, store UTC `timestamptz`, display WIB.
      - Add unit constants and converters (mm to cm, L/s to m3/s) used only at connector edges.
      - Lint against bare `getHours`/`getDate` and against `toLocale*String` without `timeZone`.
      Done when: table tests cover WIB↔UTC (including the day boundary) and mm↔cm, and lint is clean.
      Refs: G-047, G-048, CLAUDE.md conventions, 10_GUARDRAILS.md #8
- [ ] B-030 (W1, platform-security-engineer, M) Containers and the VPS layout
      **Human step (Ari):** choose the VPS provider and the object storage.
      Agent tasks:
      - Dockerfiles: `npm ci`, non-root users, a proper `.dockerignore`, copy `.next/static`, HEALTHCHECK, no data or models baked in.
      - Python lockfile (uv or pip-tools).
      - Compose stacks `noah-prod` and `noah-staging` on internal networks, with only Caddy exposed, per-stack env files and memory limits for 8 GB.
      Done when: both stacks start on one VPS, only ports 80 and 443 are open, and the images build in CI.
      Refs: G-103, G-104, G-105, 03_TARGET_ARCHITECTURE.md Infrastructure, 10_GUARDRAILS.md #14
- [ ] B-031 (W1, data-ingestion-engineer, L) Target schema migration (append-only, PostGIS)
      **Human step (Ari):** decide whether to stay on Supabase or move to another managed Postgres.
      Agent tasks:
      - Start a clean migration chain with `postgis`.
      - Create `spatial_units`, `stations`, `observations`, `pumps`, `pump_states`, `polder_params`, `rain_products`, `flood_reports`, `forecasts` (with `run_id`), `event_definitions`, `verifications`, `recommendations`, `users`, `audit_log`, plus `operator_contacts` (encrypted, admin-only), `connector_runs` and `station_unit_map`.
      - Revoke UPDATE and DELETE and add raising triggers on the fact tables; add `supersedes_id`.
      Done when: migrations apply to an empty DB in CI, and a test shows that UPDATE and DELETE on each fact table fail.
      Refs: G-057, G-060, G-061, G-062, G-063, G-064, G-065, G-066, G-067, 03_TARGET_ARCHITECTURE.md Data model, 10_GUARDRAILS.md #3 #6 #8
- [ ] B-032 (W1, data-ingestion-engineer, S) Drop the legacy tables and the seed
      Depends on: B-013 and B-031. **Human step (Ari):** approve, then export the live schema of the tables that were created outside migrations.
      Drop: `predictions`, `detections`, `alerts`, `historical_incidents`, `evacuation_locations`, `provinces`, `regencies`, `districts`, `villages`, `user_preferences`.
      Delete: `supabase/seed.sql` (TRUNCATE, BMKG-impersonating alerts) and the old migrations.
      Done when: the DB contains only target tables, and the seeds contain only configuration.
      Refs: G-057, G-058, G-059, G-017, G-027, G-124, 10_GUARDRAILS.md #1 #5 #6
- [ ] B-033 (W1, data-ingestion-engineer, S) Object storage for raw payloads and rasters
      Agent tasks:
      - Create the S3-compatible bucket with prefixes `raw/{source}/`, `rasters/` and `research/`.
      - Add a lifecycle policy and a client library that returns a `raw_ref`.
      Done when: a test connector writes a payload and the stored `raw_ref` resolves.
      Refs: G-063, 03_TARGET_ARCHITECTURE.md Store, 10_GUARDRAILS.md #7 #14
- [ ] B-034 (W1, data-ingestion-engineer, S) Station configuration with official Siaga thresholds (D12)
      Agent tasks:
      - Seed about 38 S1 posts with `external_id`, coordinates (cross-checked against `tma_2020.xlsx.csv`), `datum_note`, `unit='cm'` and `siaga_thresholds` from DSDA's table. Manggarai: Siaga 3 above 750, Siaga 2 above 850, Siaga 1 above 950 cm.
      - Fix the inverted severity order.
      - Make code read thresholds from config only.
      Done when: grep finds no 400/700/850 or 150/100 thresholds, and a test checks the Manggarai values.
      Refs: G-046, G-062, 02_CURRENT_STATE_AND_AUDIT.md D12, 04_DATA_SOURCES.md Rules, 10_GUARDRAILS.md #7 #8
- [ ] B-035 (W1, data-ingestion-engineer, M) Connector framework and scheduler
      A Python worker on APScheduler with:
      - one module per source and isolated failure;
      - exponential backoff and conditional GET;
      - an identified User-Agent;
      - raw payloads to object storage, plus `ingested_at` and `raw_ref`;
      - range checks that set `quality_flag` (flag, never drop);
      - a `connector_runs` log.
      Done when: a dummy connector passes tests for backoff, an idempotent re-poll and flagging.
      Refs: G-042, 03_TARGET_ARCHITECTURE.md Connectors, 04_DATA_SOURCES.md Rules, 10_GUARDRAILS.md #4 #7 #8 #12
- [ ] B-036 (W1, data-ingestion-engineer, M) Connector for Posko Banjir DSDA (S1)
      Behaviour: one request per 5 min, using the XML endpoint once DSDA confirms it. Normalized to cm and UTC.
      Done when: rows arrive every 5 min in `observations` for all posts; the raw payload is stored; health shows freshness; parser tests use saved fixtures.
      Refs: G-037, 04_DATA_SOURCES.md S1 S13, 10_GUARDRAILS.md #4 #6 #7 #8
- [ ] B-037 (W1, data-ingestion-engineer, M) Connector for BPBD Info Banjir (S4)
      Behaviour: an hourly polite scrape that writes RT-level `flood_reports` (RT code, `ts_start`/`ts_end`, `depth_cm`) and keeps no individual data.
      Done when: reports for flooded RTs are appended with `raw_ref`, and parser tests run on fixtures. The archive is requested separately (B-043).
      Refs: G-040, G-064, 04_DATA_SOURCES.md S4, 10_GUARDRAILS.md #3 #4 #6
- [ ] B-038 (W1, data-ingestion-engineer, M) Connector for BMKG nowcast images (S5)
      Behaviour: public images every 10 min into object storage, with `rain_products` rows carrying `issued_at` and `valid_at`.
      Done when: 24 h of frames are stored with correct UTC times, and image parsing (if used) is documented as interim.
      Refs: G-041, G-063, 04_DATA_SOURCES.md S5, 05_MODULE_1_EVALUATION.md Sources, 10_GUARDRAILS.md #4 #7
- [ ] B-039 (W1, data-ingestion-engineer, S) Connector for PetaBencana (S15)
      Behaviour: polls every 5 to 10 min, filters to DKI, appends `flood_reports(source=petabencana)` with `raw_ref` and maps points to units.
      Done when: the timeframe bug is gone (it is tested), and rows are appended without updates.
      Refs: G-039, 04_DATA_SOURCES.md S15, 10_GUARDRAILS.md #6 #7
- [ ] B-040 (W1, backend-api-engineer, S) `/api/v1/health` with per-connector freshness
      Behaviour:
      - Reports last success, last `ts` and lag from `connector_runs`, with no env flags and no DB rows.
      - Raises an alert to an admin channel (Sentry or email) when a connector is stale over 15 min or a job fails twice.
      - An external free uptime monitor watches it.
      Done when: stopping a connector triggers an alert within 20 min (tested on staging).
      Refs: G-098, 03_TARGET_ARCHITECTURE.md API, 04_DATA_SOURCES.md Rules, 10_GUARDRAILS.md #12
- [ ] B-041 (W1, data-ingestion-engineer, S) Import the S2 archive (`tma_2020.xlsx.csv`)
      Agent tasks:
      - Move the file to object storage `raw/s2_opendata/` and remove it from git.
      - Import it as `observations(source='s2_opendata')`: mm to cm, naive WIB to UTC (pending DSDA confirmation), duplicates and negative datums flagged rather than dropped.
      - Use samples as parser fixtures.
      Done when: 21 posts are imported with flags, and tests cover the duplicate and negative-value cases.
      Refs: G-043, 04_DATA_SOURCES.md S2, 05_MODULE_1_EVALUATION.md Acceptance, 10_GUARDRAILS.md #6 #7 #8
- [ ] B-042 (W1, hydro-ml-engineer, S) Polder readiness scorecard
      Score the candidate polders (Pulomas, Sunter Selatan, Setiabudi Timur, Kelapa Gading) on S1 post coverage, CCTV, BPBD report history and SCADA prospects, then give the result to Ari and DSDA for the lighthouse decision.
      Done when: the scorecard is published in `docs/` with sources for every score.
      Refs: G-056, 01_PRODUCT_BRIEF.md Scope, 09_ROADMAP_AND_ACCEPTANCE.md W1
- [ ] B-043 (W1, data-ingestion-engineer, S) Draft the formal data requests
      Draft requests for S1 permission, S3, the S4 archive, S6, S7, S8 and S12, plus BMKG gridded data and the PetaBencana terms. **Human step (Ari):** send them.
      Done when: the requests are sent, and each source's status in `04` is tracked in `docs/`.
      Refs: G-050, G-052, G-053, G-054, G-094, 04_DATA_SOURCES.md, 10_GUARDRAILS.md #4

---

## W2: M1 live; geo layer
- [ ] B-044 (W2, data-ingestion-engineer, S) Open-Meteo rain fallback connector
      Behaviour: hourly and 1 to 3 h forecast rain over lighthouse polders, labelled `source='open_meteo_fallback'`, with nulls (not zeros) for gaps.
      Done when: rows carry a fallback label shown in the UI, and the terms check (Legal) is recorded.
      Refs: G-038, 04_DATA_SOURCES.md S5 fallback, 10_GUARDRAILS.md #5 #7 #14
- [ ] B-045 (W2, backend-api-engineer, M) Turn FastAPI into the v1 API skeleton
      Agent tasks:
      - Refactor `ml-service` into `/api/v1` with OpenAPI 3 (units and UTC in every schema) and an error envelope without stack traces.
      - Add a CORS allowlist, a DB layer and an auth dependency stub.
      - Consolidate rate limiting on local Redis or Postgres.
      Done when: `/api/v1/openapi.json` validates, and CI checks the contract.
      Refs: G-095, G-096, G-101, G-102, 03_TARGET_ARCHITECTURE.md API, 10_GUARDRAILS.md #8 #14
- [ ] B-046 (W2, backend-api-engineer, S) `GET /api/v1/observations`
      Behaviour: reads append-only `observations` with source, station and `ts`, filtered by station and time.
      Done when: the contract tests pass and every value carries provenance.
      Refs: G-097, 03_TARGET_ARCHITECTURE.md API, 10_GUARDRAILS.md #7
- [ ] B-047 (W2, evaluation-engineer, M) Forecast writer library and output contract
      Behaviour: append-only inserts with `source`, `model_version`, `issued_at`, `lead_min`, `valid_from/to`, `probability`/`category`, input timestamps in `payload`, and `run_id`. Idempotency key `(source, model_version, unit_id, issued_at, lead_min)`.
      Done when: tests prove that duplicates are ignored without an update and that the immutability trigger holds.
      Refs: G-066, 05_MODULE_1_EVALUATION.md Sources, 06_MODULE_2_IMPACT_NOWCAST.md Acceptance, 10_GUARDRAILS.md #6 #7
- [ ] B-048 (W2, evaluation-engineer, S) Store event definition v1
      Store "≥ 10 cm at ≥ 1 RT in hour h" as `event_definitions` v1, with `agreed_with = NULL` until DSDA and BPBD sign it.
      Done when: every metric output carries the version.
      Refs: G-080, 05_MODULE_1_EVALUATION.md Event definition
- [ ] B-049 (W2, evaluation-engineer, S) Log DSDA Siaga status as forecasts
      Behaviour: a status change at a post becomes an alert for the units in `station_unit_map`, with the agreed validity window. Coastal tidal posts follow a documented rule.
      Done when: `forecasts(source='dsda_siaga')` rows come from live S1 data and from the S2 backtest.
      Refs: G-066, G-046, 05_MODULE_1_EVALUATION.md Sources, 10_GUARDRAILS.md #6 #9
- [ ] B-050 (W2, hydro-ml-engineer, S) Log an interim rainfall-threshold baseline
      Behaviour: a simple per-polder rain threshold (past 1 h and 3 h, plus forecast) logged as `source='baseline'` and `model_version='baseline-interim'`. This resolves plan issue P5.
      Done when: rows are written every cycle for the lighthouse polders.
      Refs: G-087, 05_MODULE_1_EVALUATION.md Acceptance, 06_MODULE_2_IMPACT_NOWCAST.md step 2, 10_GUARDRAILS.md #9
- [ ] B-051 (W2, evaluation-engineer, M) Matching engine, verifications and M1 metrics
      Behaviour:
      - Hit, miss, false alarm and correct negative.
      - Lead time.
      - POD, FAR, CSI, frequency bias, Brier and reliability data.
      - A nightly 72 h re-match that appends results (the latest `computed_at` wins).
      Done when: table tests pass for late reports, overlapping windows, boundary times and multiple positives, and the formulas match hand-computed tables.
      Refs: G-081, 05_MODULE_1_EVALUATION.md Matching Metrics, 10_GUARDRAILS.md #6 #9 #11
- [ ] B-052 (W2, evaluation-engineer, S) `GET /api/v1/scoreboard`
      Behaviour: results per source, polder, lead bucket (60/120/180), week and cumulative, always including the baseline row and the event-definition version.
      Done when: the API returns live M1 data and contract tests pass.
      Refs: G-082, 03_TARGET_ARCHITECTURE.md API, 05_MODULE_1_EVALUATION.md Outputs, 10_GUARDRAILS.md #9
- [ ] B-053 (W2, operator-ui-engineer, M) App shell, navigation and operator i18n
      Agent tasks:
      - Six nav items: Ringkasan, Polder, Rekomendasi, Skor, Laporan, Admin.
      - A new Indonesian-first operator dictionary that persists the language choice.
      - Lint against raw JSX strings.
      - A model-version badge in place of the LSTM status.
      Done when: every operator string comes from the dictionary.
      Refs: G-115, G-116, 08_ROLES_AND_ACCESS.md UI pages, 10_GUARDRAILS.md #15
- [ ] B-054 (W2, operator-ui-engineer, S) `SourceStamp` component and connector health strip
      Behaviour: "data terakhir HH:MM WIB (n mnt lalu)" with source, station and model, values greyed out after 15 min, and a health strip on every page.
      Done when: component tests cover the fresh and stale states.
      Refs: G-122, G-130, 10_GUARDRAILS.md #7 #12
- [ ] B-055 (W2, operator-ui-engineer, S) Typed API client generated from OpenAPI
      Agent tasks: generate a client to replace `lib/api.client.ts`, `lib/api.ts` and `lib/api.server.ts` and the old types, and delete the unreferenced modules and hooks.
      Done when: `tsc` and the build pass, with no import of the removed endpoints.
      Refs: G-132, G-133, 03_TARGET_ARCHITECTURE.md API
- [ ] B-056 (W2, operator-ui-engineer, M) Skor page
      Content: M1 metrics per source and lead with the baseline row beside each model, plain-language explanations in Bahasa Indonesia, recharts trends, and no accuracy or R2.
      Done when: the page renders live scoreboard data and shows the event-definition version.
      Refs: G-082, G-121, 08_ROLES_AND_ACCESS.md page 4, 05_MODULE_1_EVALUATION.md Metrics, 10_GUARDRAILS.md #9 #15
- [ ] B-057 (W2, evaluation-engineer, M) Backtest harness on the S2 January 2020 data
      Behaviour: replays the archive through the Siaga and baseline writers with `run_id`, excluded from live scores.
      Done when: forecast-side output is produced without errors, and the missing event truth (the S4 archive) is reported as a gap.
      Refs: G-084, 05_MODULE_1_EVALUATION.md Acceptance, 10_GUARDRAILS.md #6 #9
- [ ] B-058 (W2, data-ingestion-engineer, M) Load the lighthouse polders and kelurahan into `spatial_units`
      **Human step (Ari/DSDA):** choose the lighthouse polders using the B-042 scorecard.
      Sources: boundaries from S8 if granted, otherwise digitized by hand and documented. Kelurahan geometry from BPS/Jakarta Satu.
      Done when: the units are loaded with parents, and the source of each geometry is recorded.
      Refs: G-061, G-052, G-056, 09_ROADMAP_AND_ACCEPTANCE.md W2, 04_DATA_SOURCES.md S8 S14
- [ ] B-059 (W2, data-ingestion-engineer, S) Download DEM S9, subsidence S11 and exposure S14 with provenance
      Done when: the files are in object storage with licence and provenance notes, and the population is stored per kelurahan.
      Refs: G-051, 04_DATA_SOURCES.md S9 S11 S14, 10_GUARDRAILS.md #13
- [ ] B-060 (W2, hydro-ml-engineer, L) Geo pipeline and static susceptibility
      Steps: subsidence-corrected DEM, fill, depressions and HAND with WhiteboxTools (not pysheds), producing per-unit features as versioned rasters.
      Done when: features are stored per kelurahan and polder, there are no RW-level outputs, and the tests run on a small tile.
      Refs: G-086, 06_MODULE_2_IMPACT_NOWCAST.md step 1, 10_GUARDRAILS.md #13
- [ ] B-061 (W2, backend-api-engineer, S) `GET /api/v1/units` and `/units/{id}`
      Done when: the endpoints serve `spatial_units` geometry and metadata, and contract tests pass.
      Refs: G-097, 03_TARGET_ARCHITECTURE.md API
- [ ] B-062 (W2, platform-security-engineer, S) Backups and a restore test
      Behaviour: a daily logical dump to object storage with retention, plus provider backups.
      Done when: one restore into staging is documented in the runbook.
      Refs: G-070, 03_TARGET_ARCHITECTURE.md Ops

---

## W3: pilot in shadow mode
- [ ] B-063 (W3, backend-api-engineer, L) OIDC authentication, roles, RLS and audit log
      Agent tasks:
      - An adapter (`verifyToken`, `getUser`, `roleClaims`) with JWKS validation shared by Next.js and FastAPI. Supabase Auth or Keycloak sits behind it, per Ari and SCCIC.
      - The 6 roles, with `pump_operator` scoped to one polder.
      - RLS keyed on JWT claims, and a server-only admin client.
      - An append-only `audit_log` on every mutating call and export.
      - Encrypted operator contacts (admin-only) to replace B-010's interim gate.
      Done when: role tests pass in both the API and RLS, and every action appears in `audit_log`.
      Refs: G-069, G-067, G-068, 08_ROLES_AND_ACCESS.md, 03_TARGET_ARCHITECTURE.md ISSP compatibility, 10_GUARDRAILS.md #3 #6
- [ ] B-064 (W3, hydro-ml-engineer, M) M2 feature functions
      Features: rain over the past 1 h and 3 h, forecast rain 1 to 3 h, TMA relative to Siaga, upstream rise (Katulampa and Depok) and seasonality. Pure functions over `observations`, in UTC with explicit units.
      Done when: unit tests run on fixtures, including leakage checks.
      Refs: G-085, 06_MODULE_2_IMPACT_NOWCAST.md step 2, 10_GUARDRAILS.md #8 #11
- [ ] B-065 (W3, hydro-ml-engineer, M) Calibrated M2 baseline
      Behaviour: a per-polder logistic fit or empirical frequency on B-064 features from the available history, plus susceptibility. Logged as `source='baseline'` with a new `model_version`.
      Done when: outputs are written for 60, 120 and 180 min for the lighthouse polders, with backtest metrics next to the interim baseline.
      Refs: G-087, 06_MODULE_2_IMPACT_NOWCAST.md step 2 and Acceptance, 10_GUARDRAILS.md #6 #7 #9
- [ ] B-066 (W3, hydro-ml-engineer, L) M3 water balance, drawdown advice and pump anomaly rules in simulator mode
      Behaviour: implements the `07` balance and time-to-full, the wet and dry drawdown advice and anomaly rules 1 and 2. Simulator rows use `source='simulator'` with inventory capacities, are labelled SIMULASI and are excluded from M1. Advice only, with no setpoints.
      Done when: table tests cover the balance, and the simulator runs end to end on staging.
      Refs: G-091, G-065, 07_MODULE_3_POLDER_OPS.md, 10_GUARDRAILS.md #2 #5 #11
- [ ] B-067 (W3, hydro-ml-engineer, S) Pump-aware adjustment
      Behaviour: a documented rule that raises the probability when M3 says the sump fills within the lead time, or when pumps are off or anomalous.
      Done when: rule tests pass and the rule is documented.
      Refs: G-088, 06_MODULE_2_IMPACT_NOWCAST.md step 3
- [ ] B-068 (W3, hydro-ml-engineer, S) Impact estimate (exposed population)
      Behaviour: S14 population multiplied by the predicted wet share, at kelurahan level only.
      Done when: the estimate is stored in the forecast `payload` and shown with its source.
      Refs: G-089, 06_MODULE_2_IMPACT_NOWCAST.md Impact, 10_GUARDRAILS.md #7
- [ ] B-069 (W3, backend-api-engineer, M) Recommendations engine and ack API
      Agent tasks:
      - Store the trigger-to-action table as configuration.
      - Implement `GET /api/v1/recommendations?status=open` and `POST /{id}/ack` (followed, deferred or ignored, plus a note).
      - Use advisory wording ("Saran, keputusan di tangan operator").
      - Write each ack to `audit_log`.
      Done when: table tests cover the triggers, and recommendations link to `forecast_id`.
      Refs: G-090, 06_MODULE_2_IMPACT_NOWCAST.md Recommendations, 03_TARGET_ARCHITECTURE.md Operator workflow, 10_GUARDRAILS.md #1 #16
- [ ] B-070 (W3, backend-api-engineer, M) Operator WhatsApp notifier
      **Human step (Ari/DSDA):** choose the gateway and the group. **Ask before any paid service.**
      Behaviour: short Bahasa Indonesia messages with probability, window, reason and a dashboard link, sent to authenticated operator recipients only. At most one message per polder per 30 min unless the category changes. Delivery is logged on `recommendations`.
      Done when: throttle tests pass and the shadow-mode group receives messages.
      Refs: G-099, 03_TARGET_ARCHITECTURE.md Notifier, 06_MODULE_2_IMPACT_NOWCAST.md Recommendations, 10_GUARDRAILS.md #1 #3 #14 #17
- [ ] B-071 (W3, backend-api-engineer, S) `GET /api/v1/polders/{id}/status` and `/api/v1/nowcast/current`
      Behaviour: M3 level, volume, time to full, pumps and anomalies, plus the latest M2 per polder, read from stored rows only.
      Done when: the role scope is tested (`pump_operator` sees only its own polder) and stale data is flagged by `issued_at`.
      Refs: G-097, G-075, 03_TARGET_ARCHITECTURE.md API, 10_GUARDRAILS.md #7
- [ ] B-072 (W3, operator-ui-engineer, M) `OperatorMap` and the Ringkasan page
      Agent tasks:
      - Extract `OperatorMap` from `FloodMap.tsx`.
      - Reuse the tiling frame and `TimelineScrubber` for the 60/120/180 lead selector.
      - Colour polders by probability, and show the open recommendation count and the health strip.
      Done when: the page renders live nowcast data with `SourceStamp` on every value, and works on a phone.
      Refs: G-117, G-119, G-126, G-021, 08_ROLES_AND_ACCESS.md page 1, 10_GUARDRAILS.md #7 #15
- [ ] B-073 (W3, operator-ui-engineer, L) Polder detail page
      Content: a `/polder/[code]` deep link; a level chart with Siaga lines from config; a rain chart; pumps; time to full (SIMULASI-labelled until S6 arrives); open recommendations; history.
      Done when: the page renders for each lighthouse polder.
      Refs: G-127, G-121, 08_ROLES_AND_ACCESS.md page 2, 07_MODULE_3_POLDER_OPS.md, 10_GUARDRAILS.md #5 #7
- [ ] B-074 (W3, operator-ui-engineer, M) Rekomendasi page
      Content: a queue with acknowledgement, action and note fields, using advisory wording.
      Done when: an ack round-trips to the API and appears in `audit_log`.
      Refs: G-128, 08_ROLES_AND_ACCESS.md page 3, 10_GUARDRAILS.md #16
- [ ] B-075 (W3, operator-ui-engineer, M) Flood reports layer and correction form
      Content: BPBD and PetaBencana reports at RT level with source and time. A `bpbd_pusdalops` correction form that appends rather than edits.
      Done when: a correction creates a new row with `supersedes_id`.
      Refs: G-131, 08_ROLES_AND_ACCESS.md bpbd_pusdalops, 10_GUARDRAILS.md #6 #7
- [ ] B-076 (W3, operator-ui-engineer, S) Profile page and operator privacy notice
      Content: the settings page becomes a profile (language and theme). The UU PDP privacy notice text comes from Legal and sits behind login.
      Done when: the profile and notice pages render and there is no notification setting for non-admins.
      Refs: G-124, G-125, 08_ROLES_AND_ACCESS.md, 10_GUARDRAILS.md #3
- [ ] B-077 (W3, operator-ui-engineer, M) Minimal Admin page
      Content: users and roles, stations and Siaga thresholds, and the trigger-to-action table, with every change audited.
      Done when: an admin can add an operator and edit a threshold, and both actions appear in `audit_log`.
      Refs: G-129, 08_ROLES_AND_ACCESS.md page 6, 10_GUARDRAILS.md #3 #6
- [ ] B-078 (W3, operator-ui-engineer, S) One-page operator guide in Bahasa Indonesia
      Content: how to read the probabilities, the SIMULASI label and staleness, and that the operator decides. Seeded from the education text moved in B-009.
      Done when: the guide is in `docs/` and reviewed by Ari.
      Refs: G-138, 09_ROADMAP_AND_ACCEPTANCE.md W3, 10_GUARDRAILS.md #15 #16

---

## W4 to W6: integrate granted data, iterate
- [ ] B-079 (W4-W6, data-ingestion-engineer, M) Integrate the DSDA archive (S3)
      **Blocked: S3 access.**
      Done when: 5-min TMA and 55 ARR (2020 to 2026) are imported within 5 working days of access, with provenance, and backtests are re-run.
      Refs: G-050, 04_DATA_SOURCES.md S3, 09_ROADMAP_AND_ACCEPTANCE.md W4-W6, 10_GUARDRAILS.md #4 #6
- [ ] B-080 (W4-W6, data-ingestion-engineer, M) Read-only SCADA connector (S6)
      **Blocked: S6 access.**
      Behaviour: read-only credentials enforced at the connector; `pump_states` and sump levels at 15 min or better; the CI deny-list stays green.
      Done when: real rows replace the simulator for granted polders within 5 working days.
      Refs: G-053, G-114, 04_DATA_SOURCES.md S6, 07_MODULE_3_POLDER_OPS.md, 10_GUARDRAILS.md #2 #4
- [ ] B-081 (W4-W6, data-ingestion-engineer, S) Pump inventory per pump house (S7)
      **Blocked: S7 access.** Until then, enter lighthouse-polder data by hand and never invent capacities.
      Done when: `pumps.capacity_m3s` is loaded from DSDA, converted from L/s at the edge if needed.
      Refs: G-052, G-065, 04_DATA_SOURCES.md S7, 10_GUARDRAILS.md #8
- [ ] B-082 (W4-W6, data-ingestion-engineer, M) Drainage network and polder boundaries (S8)
      **Blocked: S8 access.**
      Done when: the manually digitized boundaries are superseded by SIGA/MAPID geometry (as new rows), and `polder_params` is re-estimated.
      Refs: G-052, G-061, 04_DATA_SOURCES.md S8
- [ ] B-083 (W4-W6, data-ingestion-engineer, M) CCTV connector or VIANA ingestion (S12)
      **Blocked: S12 access and the VIANA decision.**
      Behaviour: an allowlisted camera registry, snapshots in object storage, results as `flood_reports(source=cctv)`, no frame egress, non-AGPL detector only, and verification through M1.
      Done when: one camera is ingested end to end.
      Refs: G-054, 04_DATA_SOURCES.md S12, 03_TARGET_ARCHITECTURE.md ISSP compatibility, 10_GUARDRAILS.md #4 #13
- [ ] B-084 (W4-W6, data-ingestion-engineer, S) Import the BPBD S4 archive as event truth
      **Blocked: S4 archive access.**
      Done when: archived RT reports are appended to `flood_reports`, and the B-057 backtest produces POD, FAR and CSI.
      Refs: G-040, G-084, 04_DATA_SOURCES.md S4, 05_MODULE_1_EVALUATION.md Acceptance
- [ ] B-085 (W4-W6, evaluation-engineer, M) Automatic weekly report and Laporan page
      Behaviour: HTML and PDF every Monday at 07:00 WIB, in Bahasa Indonesia, with plain-language metrics, internal only. `GET /api/v1/reports/weekly/{iso_week}`. A Laporan list page with PDF export for `dsda_supervisor`, with exports audited.
      Done when: two consecutive Mondays are generated automatically.
      Refs: G-083, 05_MODULE_1_EVALUATION.md Outputs, 08_ROLES_AND_ACCESS.md page 5, 10_GUARDRAILS.md #9 #15
- [ ] B-086 (W4-W6, evaluation-engineer, S) Weekly operator feedback loop
      Behaviour: collect operator feedback every week, through the ack notes and a short form, and turn it into backlog items.
      Done when: there is one feedback summary per week in `docs/`.
      Refs: no G- row (process item, not an existing code area); 09_ROADMAP_AND_ACCEPTANCE.md W4-W6, 01_PRODUCT_BRIEF.md Success 5
- [ ] B-087 (W4-W6, operator-ui-engineer, M) Full Admin page
      Content: connectors (enable and pause, freshness), WhatsApp recipients (encrypted, admin-only) and station geometry through `MapPicker`.
      Done when: every admin action is audited and role tests pass.
      Refs: G-129, 08_ROLES_AND_ACCESS.md page 6, 10_GUARDRAILS.md #3
- [ ] B-088 (W4-W6, backend-api-engineer, S) MQTT publisher and partner webhooks (flag, off by default)
      Behaviour: `noah/v1/{polder_code}/nowcast` and `/status` topics carrying outputs only, never control topics, plus signed opt-in webhooks for authenticated partners.
      Done when: a feature-flag test and a schema test pass.
      Refs: G-100, 03_TARGET_ARCHITECTURE.md ISSP compatibility, 10_GUARDRAILS.md #1 #2
- [ ] B-089 (W4-W6, data-ingestion-engineer, S) Log JaWaRA (S16) and Flood Hub (S17) if retrievable
      **Blocked: S16 access / S17 retrievability.** PARK until then.
      Done when: rows are logged as `forecasts` for M1 only, and never used as M2 input.
      Refs: G-055, 04_DATA_SOURCES.md S16 S17, 05_MODULE_1_EVALUATION.md Sources

---

## W7 to W8: models compete
- [ ] B-090 (W7-W8, hydro-ml-engineer, M) Reproducible training and backtest pipeline
      Behaviour: a CLI with a data snapshot id, config, `model_version`, a held-out period, M1 metrics, and the baseline next to every model.
      Done when: a re-run reproduces the same metrics from the same snapshot.
      Refs: G-092, 06_MODULE_2_IMPACT_NOWCAST.md step 4, 10_GUARDRAILS.md #9 #11
- [ ] B-091 (W7-W8, hydro-ml-engineer, M) Gradient-boosting challenger
      Behaviour: LightGBM (MIT) or XGBoost (Apache-2.0) on the baseline features plus susceptibility and seasonality, trained on CPU, with no GPU hours needed.
      Done when: the challenger is logged as its own `forecasts` source in shadow mode.
      Refs: G-093, 06_MODULE_2_IMPACT_NOWCAST.md step 4, 10_GUARDRAILS.md #9 #13 #14
- [ ] B-092 (W7-W8, evaluation-engineer, S) Select the winning model by M1 rules
      Rule: the challenger replaces the baseline in recommendations only if its CSI at 60 min or more is higher on the held-out period and its FAR is not worse. Both keep logging.
      Done when: the decision record with metrics is published on the Skor page and in `docs/`.
      Refs: G-093, G-081, 06_MODULE_2_IMPACT_NOWCAST.md step 4, 09_ROADMAP_AND_ACCEPTANCE.md W7-W8
- [ ] B-093 (W7-W8, hydro-ml-engineer, M) Calibrate M3 on SCADA logs
      **Blocked: S6 logs.**
      Done when: calibrated `polder_params` exist for at least one polder (as new rows), and the time-to-full error against observed events is reported.
      Refs: G-091, 07_MODULE_3_POLDER_OPS.md Acceptance, 10_GUARDRAILS.md #6
- [ ] B-094 (W7-W8, hydro-ml-engineer, M) pySTEPS rain nowcast
      **Blocked: BMKG gridded data or radar.**
      Behaviour: probabilistic rain fields for 0 to 3 h (BSD-3), fed into M2. No deep-learning nowcast built from scratch.
      Done when: the nowcast runs on received data and its effect is reported through M1.
      Refs: G-094, 06_MODULE_2_IMPACT_NOWCAST.md step 5, 01_PRODUCT_BRIEF.md non-goals
- [ ] B-095 (W7-W8, hydro-ml-engineer, S) Add polders if the data supports it
      Behaviour: re-run the readiness scorecard and add DKI polders only; no national coverage.
      Done when: the new polders have units, stations and baseline outputs.
      Refs: G-056, G-061, 09_ROADMAP_AND_ACCEPTANCE.md W7-W8, 01_PRODUCT_BRIEF.md Scope

---

## W9: report and handover
- [ ] B-096 (W9, evaluation-engineer, M) Final evaluation report
      Content: POD, FAR, CSI, Brier and lead time per source, polder and lead time, for Noah and every logged source, with the baseline alongside and the event-definition version stated.
      Done when: the report is in `docs/` and the continuation criteria (`01` Success 5) are evaluated.
      Refs: G-081, G-083, 01_PRODUCT_BRIEF.md Success, 05_MODULE_1_EVALUATION.md Metrics, 10_GUARDRAILS.md #9
- [ ] B-097 (W9, data-ingestion-engineer, S) Data availability lists and blind spots
      Content: sources proven available, sources still closed, and polders that flood often but have no usable sensor or CCTV.
      Done when: the lists are in `docs/` and reviewed by Ari.
      Refs: G-050, G-052, G-053, G-054, 01_PRODUCT_BRIEF.md Success 3 4, 04_DATA_SOURCES.md
- [ ] B-098 (W9, platform-security-engineer, M) Runbook, architecture doc, final operator guide and README
      Content: rewrite the README for the operator DSS and finalize the guardrail check.
      Done when: the docs are complete and a qa-verifier guardrail pass is green.
      Refs: G-136, G-137, G-138, 09_ROADMAP_AND_ACCEPTANCE.md W9
- [ ] B-099 (W9, platform-security-engineer, S) Handover and keep-running check
      Content: a restore test, an alert test, a key-rotation runbook and the on-call contacts.
      Done when: the system keeps running for the rest of the wet season with documented ownership.
      Refs: G-070, G-098, G-110, 09_ROADMAP_AND_ACCEPTANCE.md W9, 10_GUARDRAILS.md #12

---

## Parked rows (no scheduled item)
- **G-018 chatbot:** disabled in B-014. Revisit only after the CITYA decision and with a budgeted model (plan issue P3).
- **G-033 RainViewer:** off by default (B-022). Revisit when BMKG frames exist.
- **G-045 `hujan_bogor2022.csv`:** research covariate only, once its provenance is confirmed.
- **G-123 PWA:** disabled in B-009.
- **G-135 untracked root items:** Ari decides.
- **G-137 `documentation/`:** archived in B-023.
