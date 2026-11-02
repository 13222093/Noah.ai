# Backend / API audit (Phase A, audit only)

Author: `backend-api-engineer`. Date: 2026-11-02. Scope: `app/api/**`, `app/test/route.ts`, `lib/**`, `src/lib/**`, `ml-service/src/**`, `supabase/**`, `scripts/`, `docker-compose.yml`, `vercel.json`, `.github/workflows/ci.yml`.
Read-only audit. No application code changed. Secrets are referenced by file:line and kind only.

## Summary

- **Route handlers found: 47.** 39 Next.js (method+path) in 33 `route.ts` files, plus 8 FastAPI endpoints in `ml-service/src/main.py`. (`app/api/test.css` is a stray file, not a route.)
- **Authentication:** none in practice. No login page, no `middleware.ts`, no OIDC. The only session check is `supabase.auth.getUser()` in `app/api/preferences/route.ts:11,46`, and nothing in the UI calls that route or offers sign-in. FastAPI has no auth. Its one "admin" gate is a shared secret read from the JSON body, not from a header (`ml-service/src/main.py:105-112`).
- **Reachable without auth: 44 of 47.** Every unauthenticated route serves the public web app or the open internet. 3 are gated: `/api/preferences` GET and POST, and FastAPI `/admin/set-demo-mode`. FastAPI port 8000 is published on the host (`docker-compose.yml`, ml-service `ports: 8000:8000`).
- **Routes that send or show warnings to the public (Guardrail 1): 6.** These are `/api/sms-alert`, `/api/sms-subscribe` (enrolment), `/api/smart-alert`, `/api/predict` and `/api/scenarios/[id]` (both pass "SIAGA 1 - EVAKUASI SEGERA" text from FastAPI to the public UI), and `/api/alerts`. FastAPI `/predict` and `/predict/scenario/{id}` produce that text.
- **Supabase:** 9 tables in migrations: `evacuation_locations`, `laporan_banjir`, `predictions`, `detections`, `sms_subscribers`, `sms_logs`, `historical_incidents`, `alerts`, plus enum types. Code also uses tables that no migration creates: `provinces`, `regencies`, `districts`, `villages`, `user_preferences`, and a storage bucket `laporan-banjir`. Columns `prediction_risk` and `prediction_probability` are written but not in any migration. The live DB has drifted from the migrations.
- **Decision counts (53 rows):** KEEP 0, REFACTOR 7, REBUILD 5, NEW 16, DELETE 22, PARK 3.
- **Twilio verdict: DELETE.** It sends citizen SMS ("Segera evakuasi!") to self-subscribed residents. It is triggerable by anyone through unauthenticated `POST /api/sms-alert` and `POST /api/smart-alert`. The subscriber phone numbers are readable with the public anon key. Rebuild the operator notifier as NEW (WhatsApp group plus email) and reuse only the delivery-log pattern.
- **Chatbot verdict: PARK.** 2 of its 8 tools feed it non-live or broken data, and it has no provenance and no auth. It uses Gemini, while the budget names the Anthropic API. It could return later as an operator assistant built on v1 API tools, which overlaps SCCIC CITYA.
- **Guardrails violated:** 1, 3, 5, 7, 8, 10, 14 (details in the last section). No SCADA, pump or gate write paths were found (Guardrail 2 OK).

## Route table

Auth key: "none" = no authentication of any kind. DB key: anon = `NEXT_PUBLIC_SUPABASE_ANON_KEY`, SR = `SUPABASE_SERVICE_ROLE_KEY`. Public = reachable without auth and serves the public web app or the internet.

### Next.js (`app/api/**`, `app/test`)

| # | Method | Path | File | What it does | Data source | Auth | Public | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | /api/ai-alerts | `app/api/ai-alerts/route.ts:19` | Gemini prompt (alert analysis, news summary, historical analysis) plus generated "statistics" | Gemini `gemini-1.5-flash`; `Math.random()` at lines 258-281 | none (in-memory IP rate limit) | Yes | G5 fake stats; logs the raw body (line 37) |
| 2 | GET | /api/ai-alerts | same:370 | health string | static | none | Yes | |
| 3 | GET | /api/air-quality | `app/api/air-quality/route.ts:5` | WAQI proxy | api.waqi.info, `WAQI_API_TOKEN` | none | Yes | G5: canned AQI 42 when no token (lines 17-30) |
| 4 | GET | /api/alerts | `app/api/alerts/route.ts:6` | Lists the `alerts` table | Supabase anon, server cookie client | none | Yes | G1 public alerts; seed data (`supabase/seed.sql:75`) |
| 5 | POST | /api/analysis | `app/api/analysis/route.ts:8` | Open Gemini proxy for an arbitrary `prompt` | Gemini `gemini-2.5-flash` | none, **no rate limit** | Yes | Cost abuse; echoes `JSON.stringify(error)` (line 63) |
| 6 | POST | /api/cctv-scan | `app/api/cctv-scan/route.ts:9` | Fetches **any** `source_url` from the server and forwards it to ML `/verify-visual` | caller-supplied URL, then FastAPI, then Roboflow | none | Yes | **SSRF** (line 26) |
| 7 | POST | /api/chatbot | `app/api/chatbot/route.ts:87` | Gemini function calling, 8 tools | Gemini `gemini-2.5-flash` plus internal and external APIs | none (in-memory IP rate limit) | Yes | See chatbot section |
| 8 | GET | /api/chatbot | same:243 | health string | static | none | Yes | |
| 9 | GET | /api/dashboard | `app/api/dashboard/route.ts:7` | OpenWeatherMap weather and air pollution | OWM, `OPENWEATHER_API_KEY` (placeholder fallback at line 3) | none | Yes | G5: hardcoded "forecast" (lines 36-40) |
| 10 | GET | /api/disaster-proxy | `app/api/disaster-proxy/route.ts:6` | PetaBencana reports proxy | api.petabencana.id (S15) | none | Yes | Real data; `timeframe=1h` silently becomes 24h |
| 11 | GET | /api/disaster-reports | `app/api/disaster-reports/route.ts:11` | Returns a **stub** "Data from Peta Bencana API" | none (simulated, lines 54-59); Upstash cache and rate limit | none | Yes | G5 |
| 12 | GET | /api/evacuation | `app/api/evacuation/route.ts:7` | Lists shelters with **randomized** status | Supabase SR, `evacuation_locations`; `Math.random()` lines 21-30 | none | Yes | D6, G5 |
| 13 | POST | /api/flood-analysis | `app/api/flood-analysis/route.ts:70` | Gemini analysis of client-supplied data | Gemini `gemini-1.5-flash-latest`, `GOOGLE_API_KEY` | none (in-memory IP rate limit) | Yes | |
| 14 | GET | /api/flood-reports | `app/api/flood-reports/route.ts:7` | `select *` from `laporan_banjir` | Supabase **SR** | none | Yes | **G3: returns `reporter_name` and `reporter_contact` to anyone** |
| 15 | POST | /api/flood-reports | same:30 | Citizen flood report insert | Supabase SR | none | Yes | G3 personal data collection |
| 16 | GET | /api/health | `app/api/health/route.ts:7` | App and Supabase check (reads `provinces`) | Supabase SR | none | Yes | Shows env-var presence flags |
| 17 | GET | /api/ml-health | `app/api/ml-health/route.ts:3` | Proxy to FastAPI `/health` | FastAPI | none | Yes | |
| 18 | POST | /api/news-summary | `app/api/news-summary/route.ts:4` | Batch-calls `/api/ai-alerts` | relative `fetch('/api/ai-alerts')` (line 20) | none | Yes | Broken: relative URL fails server-side |
| 19 | POST | /api/predict | `app/api/predict/route.ts:4` | "Auto" mode pulls `/api/water-level` (replay) and `/api/rainfall-dual`, then FastAPI `/predict` | replay CSV, OWM, FastAPI | none (in-memory IP rate limit) | Yes | D1-D3; default level 300 cm when missing (line 33); G1 evacuation text from ML |
| 20 | GET | /api/preferences | `app/api/preferences/route.ts:4` | User preferences | Supabase anon plus user session, `user_preferences` | Supabase session | No | No caller, no login UI, table not in migrations |
| 21 | POST | /api/preferences | same:35 | Upsert preferences | same | Supabase session | No | |
| 22 | GET | /api/rainfall-dual | `app/api/rainfall-dual/route.ts:17` | OWM current `rain.1h` at 2 fixed points (Bogor, Jakarta) | OWM | none | Yes | Point weather model, not gauges; 0 when field absent |
| 23 | GET | /api/regions | `app/api/regions/route.ts:21` | Province, regency, district, village lists | Supabase SR, `provinces`, `regencies`, `districts`, `villages` (`lib/api.server.ts:26-66`) | none | Yes | CORS `*` (line 8) |
| 24 | OPTIONS | /api/regions | same:14 | CORS preflight | — | none | Yes | |
| 25 | GET | /api/scenarios | `app/api/scenarios/route.ts:3` | Proxy to FastAPI `/scenarios` | FastAPI (`ml-service/src/scenarios.py`) | none | Yes | Demo data |
| 26 | POST | /api/scenarios/[id] | `app/api/scenarios/[id]/route.ts:3` | Proxy to FastAPI `/predict/scenario/{id}` | FastAPI | none | Yes | `scenario_demo` is god mode, returns 1100 cm CRITICAL |
| 27 | GET | /api/sensor-simulator | `app/api/sensor-simulator/route.ts:45` | Replay of a 2020 CSV stamped `now()`, with per-minute "jitter" to "feel live"; random fallback | `ml-service/data/DATASET_FINAL_TRAINING.csv`; `Math.random()` lines 49-65 | none | Yes | G5, G8 (server-local `getHours`) |
| 28 | POST | /api/smart-alert | `app/api/smart-alert/route.ts:24` | Combines predict and CCTV scan into a confidence score, then **fires `/api/sms-alert`** | internal `/api/predict`, `/api/cctv-scan` | none, **no rate limit** | Yes | **G1**; SSRF via `cctv_source_url` (line 29); no UI caller |
| 29 | POST | /api/sms-alert | `app/api/sms-alert/route.ts:76` | **Sends Twilio SMS to every active subscriber in a region** | Supabase SR `sms_subscribers`, Twilio | none, **no rate limit** | Yes | **G1**; toll-fraud vector; message "Segera evakuasi!" (line 54) |
| 30 | POST | /api/sms-subscribe | `app/api/sms-subscribe/route.ts:29` | Citizen subscribes phone and name | Supabase SR | none | Yes | **G1, G3**; enumeration oracle ("already subscribed", lines 70-75) |
| 31 | DELETE | /api/sms-subscribe | same:127 | Unsubscribe any number without verification | Supabase SR | none | Yes | Anyone can unsubscribe anyone |
| 32 | GET | /api/statistics/incidents | `app/api/statistics/incidents/route.ts:6` | Lists `historical_incidents` | Supabase anon | none | Yes | Seed data (`supabase/seed.sql:68`), multi-hazard, multi-city |
| 33 | GET | /api/test | `app/api/test/route.ts:3` | Hello | static | none | Yes | |
| 34 | POST | /api/verify-visual | `app/api/verify-visual/route.ts:3` | Upload an image, FastAPI `/verify-visual` | FastAPI, Roboflow | none | Yes | Uploaded images go to a third party (Roboflow) |
| 35 | GET | /api/water-level | `app/api/water-level/route.ts:55` | **"Live" Manggarai TMA = 2020 CSV indexed by wall clock, stamped `now()`** | CSV (lines 46-53, 74, 92) | none | Yes | D1; G5, G7, G8; thresholds 400/700/850 (D12) |
| 36 | GET | /api/weather | `app/api/weather/route.ts:5` | OWM current, forecast and air pollution | OWM | none | Yes | |
| 37 | GET | /api/weather/tiles/[...tile] | `app/api/weather/tiles/[...tile]/route.ts:3` | OWM tile proxy (path regex-validated) | OWM, `OPEN_WEATHER_API_KEY` | none | Yes | Uses a different env name from the other routes |
| 38 | GET | /api/weather-history | `app/api/weather-history/route.ts:4` | OWM One Call 3.0 history | OWM (paid tier) | none | Yes | G14 paid API |
| 39 | GET | /test | `app/test/route.ts:3` | Hello | static | none | Yes | |

Routes that the UI calls but that do not exist: `/api/pump-status` (`lib/api.client.ts:136`, used by `hooks/usePumpStatusData.ts` and a chatbot tool) and `/api/flood-predict` (`app/dashboard/page.tsx:50`).

### FastAPI (`ml-service/src/main.py`, "Jakarta FloodNet API Gateway")

| # | Method | Path | Line | What it does | Auth | Public | Notes |
|---|---|---|---|---|---|---|---|
| 40 | GET | / | 82 | Banner "Final Production" | none | Yes (port 8000 published) | |
| 41 | GET | /health | 86 | Mode DEMO/LIVE, model flags | none | Yes | |
| 42 | POST | /admin/set-demo-mode | 98 | Flips global "GOD MODE": every `/predict` then returns 1100 cm CRITICAL and every `/verify-visual` returns flooded 0.99 | `_admin_secret` **in JSON body** compared to `ADMIN_SECRET` (lines 105-112); plain `!=` comparison | Yes | D4; G5 |
| 43 | GET | /admin/demo-status | 127 | Demo flag | none | Yes | |
| 44 | POST | /predict | 135 (decorated twice, 134-135) | LSTM fed 3 features (Jakarta rain duplicated) plus "physics" blend; fixed thresholds; evacuation text | none | Yes | D2, D3, G1, G5; canned timestamp `2025-11-25T10:00:00Z` (G8); unreachable fallback (lines 247-254) |
| 45 | POST | /verify-visual | 263 | Roboflow workflow over HTTP | none | Yes | G10 fallback key at `ml-service/src/yolo_model.py:48` |
| 46 | GET | /scenarios | 290 | Lists hardcoded scenarios | none | Yes | |
| 47 | POST | /predict/scenario/{scenario_id} | 298 | Scenario prediction; `scenario_demo` is god mode | none | Yes | D4 |

FastAPI has no CORS middleware, no auth dependency, no OpenAPI tags or versioning (FastAPI's auto `/docs` is on by default), and no DB access.

### Webhooks, cron, schedulers
- **Webhooks:** not found. There is no inbound Twilio status or STOP callback, even though the SMS text says "Balas STOP" (`app/api/sms-alert/route.ts:56`). Unsubscribe by reply only works through Twilio's own carrier-level STOP handling and is never reflected in `sms_subscribers`.
- **Cron:** not found. `vercel.json` has only rewrites, there is no GitHub Actions schedule, and FastAPI has no APScheduler. Nothing ingests data on a schedule; every reading is pulled when a request arrives.
- **OSRM:** browser only, through `leaflet-routing-machine` on its default public OSRM demo server (`components/flood-map/EvacuationRouting.tsx:29`, `components/map/EvacuationRouting.tsx:15`). No backend route.

## Supabase: tables, RLS, keys

| Table | Defined in | RLS | Policies | Who reads or writes, with which key | Personal data | Maps to target (`03` data model) |
|---|---|---|---|---|---|---|
| `evacuation_locations` | `supabase/migrations/001_initial_schema.sql:2-14`; seed rows 33-71 | **not enabled** in migration | none | `/api/evacuation` (SR, server) | `contact_person` and `contact_phone` of named people (seed) | none (out of scope) |
| `laporan_banjir` | `001_initial_schema.sql:17-29` | **not enabled** in migration | none. With Supabase default grants, anon can select, insert, update and delete if RLS really is off | `/api/flood-reports` GET/POST (SR, server); **browser anon insert** `app/flood-report/page.tsx:200-213`; **browser anon select `*`** `components/sensor-data/FloodReportList.tsx:69`; server anon select `app/sensor-data/page.tsx:21` | **`reporter_name`, `reporter_contact`, photo** (public bucket `laporan-banjir`, `app/flood-report/page.tsx:193-196`) | `flood_reports` conceptually, but the source must be BPBD RT (S4), not citizens |
| `predictions` | `20250309000000_create_predictions_detections.sql:2-13` | enabled | public SELECT `true`; INSERT `WITH CHECK (true)` with **no `TO` role, so anon can insert** (lines 43-44) | no code reads or writes it | no | superseded by `forecasts` |
| `detections` | same:20-30 | enabled | same as `predictions` | none | lat/lon of uploads | none (CCTV later, S12) |
| `sms_subscribers` | `20250309100000_create_sms_subscribers.sql:6-16` | enabled | anon INSERT `true`; **anon SELECT `USING (true)`** (lines 48-49); service_role ALL | `/api/sms-subscribe`, `/api/sms-alert` (SR, server) | **phone_number, name, region**. Every subscriber is readable with the public anon key | none (Guardrail 1, 3) |
| `sms_logs` | same:20-31 | enabled | service_role ALL; **anon SELECT `true`** "for transparency" (lines 59-61) | `/api/sms-alert` (SR) | **phone_number plus message text** | the delivery-log idea carries into `recommendations.sent_at/channel` |
| `historical_incidents` | `20250818100000_...sql:16-33`; also `supabase/seed.sql:31` | enabled | public SELECT `true` | `/api/statistics/incidents` (anon) | no | none |
| `alerts` | `20250818110000_create_alerts_table.sql:11-21`; also `seed.sql:51` | enabled | public SELECT `true` | `/api/alerts` (anon) | no | none (public alerts, Guardrail 1) |
| `provinces`, `regencies`, `districts`, `villages` | **not found in migrations** (seeded by `scripts/seed-regions.mjs`) | unknown | unknown | `/api/regions`, `/api/health` (SR); `test-supabase.js` (SR) | no | `spatial_units` (kelurahan = village) |
| `user_preferences` | **not found** | unknown | unknown | `/api/preferences` (anon plus session) | `default_location` | none |
| storage `laporan-banjir` | **not found** | unknown (public URLs are used) | unknown | browser anon upload | citizen photos | none |

Client modules:
- `lib/supabase/admin.ts` (SR, server, lazy proxy) and `lib/supabaseAdmin.ts` (SR, server, a duplicate with retry). Neither imports `server-only`, so only convention keeps them out of the browser.
- `lib/supabase/server.ts` (anon plus cookies, server) and `lib/supabase/client.ts` (anon, browser).
- `app/api/sms-alert/route.ts:12-17` and `app/api/sms-subscribe/route.ts:10-15` each create their own SR client.
- Service role is used for **public, unauthenticated reads** (`/api/flood-reports`, `/api/evacuation`, `/api/regions`). That bypasses RLS entirely, so no RLS policy could protect those tables.
- Migration hygiene: `001_initial_schema.sql:36` inserts `'[...]'::jsonb` into a `TEXT[]` column, and `uuid_generate_v4()` depends on `uuid-ossp`, which only `seed.sql:4` creates. As written, migration 001 cannot apply cleanly to a fresh DB.

## Auth: current state vs `08_ROLES_AND_ACCESS.md`

| Requirement (08) | Current | Gap |
|---|---|---|
| Every page requires login | No login page, no `middleware.ts`, no session handling outside `/api/preferences` | Full build |
| OIDC behind an adapter (Supabase Auth acceptable, switchable to ISSP Keycloak) | Supabase Auth SDK installed (`@supabase/ssr`); no provider configured; FastAPI has nothing | Adapter interface (`verifyToken`, `getUser`, `roleClaims`), Keycloak-compatible JWT validation (JWKS, `iss`, `aud`), shared by Next.js and FastAPI |
| 6 roles; authorization in API **and** RLS | No `users` table, no role claim, every route open | `users(role, org, phone_hash)`, role guard per v1 endpoint, RLS keyed on JWT `role` and `polder_id` (pump_operator sees only their polder) |
| Every action written to `audit_log` | Not found | Append-only `audit_log` plus middleware hook on every mutating call and on export |
| Hashed phone plus encrypted contact table, admin only | The opposite: plaintext phones readable by anon | New `operator_contacts` (pgcrypto or app-level encryption), admin-only RLS |

Distance: about 0% reusable beyond the Supabase SDK. Estimate M to L.

## Integrations

### Twilio SMS pipeline (Guardrail 1, 3)
- Path: public page `app/sms-subscribe/page.tsx:48` → `POST /api/sms-subscribe` → `sms_subscribers`. Separately, `POST /api/smart-alert` (no UI caller, but public) → `POST /api/sms-alert` → `twilio.messages.create` to **every active subscriber of the region** (`app/api/sms-alert/route.ts:113-161`). Messages: "PERINGATAN BANJIR … Segera evakuasi!"
- **It sends to the public.** This is a direct breach of Guardrail 1 (UU 31/2009, UU 24/2007).
- Security: no auth, no rate limit, and the caller picks `alert_level` and `region_id`. One curl call can mass-message residents with a false evacuation order and run up Twilio cost.
- Personal data: phone and name are readable by anon (RLS `USING (true)`), and logs with phones are public.
- Verdict: **DELETE** the routes, the page and the tables. Purge subscriber data under a documented UU PDP process; the human must approve the purge. Then build a **NEW** operator notifier with WhatsApp group plus email, authenticated recipients and a per-polder rate limit (G17).

### Gemini chatbot (`app/api/chatbot/route.ts`)
The 8 tools (lines 50-57):

| Tool | Backing | Real data? | Fabrication risk |
|---|---|---|---|
| `fetchWaterLevelData` | `/api/water-level` | **No.** 2020 replay stamped `now()` | **Yes.** The LLM presents 2020 Manggarai TMA as current |
| `fetchPumpStatusData` | `/api/pump-status` | **Route missing (404)** | Always errors. The LLM may fill the gap with invented pump status |
| `fetchBmkgLatestQuake` | data.bmkg.go.id autogempa | Yes | Out of scope (earthquakes) |
| `requestUserLocation` | client action | n/a | none |
| `fetchPetabencanaReports` | `/api/disaster-proxy` (S15) | Yes | Default `1h` is silently mapped to 24h |
| `geocodeLocation` | Nominatim | Yes | Weak User-Agent with no contact; Nominatim policy |
| `fetchWeatherData` | OWM current | Yes | Silently falls back to Jakarta coordinates (line 195) |
| `displayNotification` | client popup | n/a | The LLM can push arbitrary popup text to the public |

Other gaps: no provenance or timestamps in answers (G7), no auth, a public audience, history taken from the client unvalidated (prompt injection through `history`), and in-memory rate limiting.
Verdict: **PARK.** It is not part of the December scope (`01` lists CITYA as SCCIC's operator assistant). If it is revived, rebuild it as an authenticated operator assistant whose only tools are v1 read endpoints. Every answer must cite station, model version and timestamp, and the model choice must stay within G14 (the budget names Anthropic about USD 20 per month, not Gemini).

Related Gemini routes (`/api/ai-alerts`, `/api/analysis`, `/api/flood-analysis`, `/api/news-summary`) are generic LLM proxies with fake stats or broken calls: **DELETE**.

### Other external calls (backend side)
OpenWeatherMap (5 routes; env names are inconsistent: `OPENWEATHER_API_KEY` vs `OPEN_WEATHER_API_KEY`; `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` is exposed to the client), WAQI, PetaBencana, BMKG autogempa, Nominatim, Roboflow (from FastAPI), Upstash Redis (`src/lib/redis.ts`). None of them carry provenance into the response, and none record ingestion.

## Inventory and decisions

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| BE-001 | Authentication (OIDC adapter) | Not found. Only `supabase.auth.getUser()` in `app/api/preferences/route.ts:11,46`; no login UI; FastAPI no auth | `08` implementation notes; `03` ISSP compatibility (OIDC/Keycloak) | NEW | M | backend-api-engineer | BE-003 | Shared JWT verification for Next.js and FastAPI; Supabase Auth or a local Keycloak as the first provider |
| BE-002 | Route protection | No `middleware.ts`; 44 of 47 handlers open | `08` "Every page requires login" | NEW | S | backend-api-engineer | BE-001 | Deny by default; allowlist only `/api/v1/health` (and maybe a liveness probe) |
| BE-003 | Users and roles | Not found | `03` data model `users`; `08` role table | NEW | S | backend-api-engineer | BE-018 | 6 roles; `pump_operator` scoped by `polder_id` |
| BE-004 | Audit log | Not found | `03` `audit_log`; `08` "Every action written" | NEW | S | backend-api-engineer | BE-003 | Append-only (G6 pattern); covers ack, export, admin changes |
| BE-005 | Operator contact storage | Not found. Today: plaintext phones in `sms_subscribers` readable by anon | `08` notes (hashed plus encrypted, admin only); `10` #3 | NEW | S | backend-api-engineer | BE-003 | G3. pgcrypto or app-level encryption; key in env (G10) |
| BE-006 | RLS per role | Current policies are all `USING (true)` (`20250309000000...sql:39-44`, `20250309100000...sql:44-61`, `20250818*.sql`) | `08` "enforced in API and RLS" | NEW | M | backend-api-engineer | BE-018, BE-001 | Stop using service_role for user-facing reads |
| BE-007 | OpenAPI 3 spec and `/api/v1` namespace | Not found (FastAPI auto-docs only, unversioned) | `03` API v1; ISSP compatibility | NEW | M | backend-api-engineer | BE-042 | Explicit units and UTC in every schema (G8); consistent error envelope without stack traces |
| BE-008 | `GET /api/v1/units` | `app/api/regions/route.ts` plus `lib/api.server.ts:26-66`, 34-province admin tables (not in migrations), CORS `*` | `03` `spatial_units`; API `/units` | REBUILD | M | backend-api-engineer | BE-018, geo pipeline | Kelurahan from `villages` may be reused as seed after verification; polder geometry from S8 or digitized |
| BE-009 | `GET /api/v1/observations` | `app/api/water-level/route.ts:46-53,74,92`: 2020 CSV replay stamped `now()`; thresholds 400/700/850 (lines 85-88) | `03` API `/observations`; `04` S1; D1, D12 | REBUILD | M | backend-api-engineer | data-ingestion S1 connector, BE-018 | G5, G7, G8. Thresholds come from `stations.siaga_thresholds` |
| BE-010 | Sensor simulator | `app/api/sensor-simulator/route.ts:49-65` (`Math.random`), 77-82 (jitter "to feel live") | none; `10` #5 | DELETE | S | backend-api-engineer | — | G5 |
| BE-011 | `GET /api/v1/forecasts`, `GET /api/v1/nowcast/current` | `app/api/predict/route.ts` forwards to FastAPI `/predict`; default 300 cm (line 33); evacuation text passed through | `03` API; `06` M2 | REBUILD | M | backend-api-engineer | hydro-ml M2, BE-018 | G1, G5. Read-only from append-only `forecasts`; no on-request inference |
| BE-012 | Scenario routes | `app/api/scenarios/route.ts`, `app/api/scenarios/[id]/route.ts`; `ml-service/src/scenarios.py` (`scenario_demo` god mode) | `10` #5 (demo only behind `NOAH_DEMO_MODE`) | PARK | S | backend-api-engineer | — | Keep only for UI tests, labeled SIMULASI, never written to `forecasts` |
| BE-013 | `GET /api/v1/polders/{id}/status` | Not found (`/api/pump-status` called by `lib/api.client.ts:136` but missing) | `03` API; `07` M3 | NEW | M | backend-api-engineer | hydro-ml M3, BE-018 | Role scope: pump_operator sees own polder only |
| BE-014 | `GET /api/v1/recommendations`, `POST /{id}/ack` | Not found | `03` API and operator workflow steps 3-4; `06` trigger-to-action | NEW | M | backend-api-engineer | BE-018, BE-004 | G16 wording; ack writes `audit_log` |
| BE-015 | `GET /api/v1/scoreboard` | Not found | `03` API; `05` M1 | NEW | S | backend-api-engineer | evaluation M1 | G9 honest metrics; role dsda_supervisor and up |
| BE-016 | `GET /api/v1/reports/weekly/{iso_week}` | Not found | `03` API; `05` | NEW | S | backend-api-engineer | evaluation | Export logged in `audit_log` |
| BE-017 | `GET /api/v1/health` | `app/api/health/route.ts` (Supabase ping on `provinces`, env flags); `app/api/ml-health/route.ts` | `03` API `/health` (per-connector freshness); `10` #12 | REFACTOR | S | backend-api-engineer | connectors | Drop env-presence flags from the public response |
| BE-018 | Target schema migrations (append-only) | Not found. Existing migrations do not match `03`; drift: `prediction_risk`/`prediction_probability` written at `app/flood-report/page.tsx:210-211` but absent from migrations; `001_initial_schema.sql:36` type mismatch | `03` data model; `10` #6 | NEW | L | backend-api-engineer | Postgres/PostGIS choice | Enforce append-only with REVOKE UPDATE/DELETE plus triggers; `supersedes_id` |
| BE-019 | `sms_subscribers`, `sms_logs` | `supabase/migrations/20250309100000_create_sms_subscribers.sql` (anon SELECT `true` at lines 48-49 and 59-61) | `08` "out of scope"; `10` #1 #3 | DELETE | S | backend-api-engineer | human approval for data purge | **G1, G3.** Personal data readable by anon now. Revoke policies immediately, then purge |
| BE-020 | `POST /api/sms-alert` | `app/api/sms-alert/route.ts:76-213` (Twilio send to all subscribers, no auth) | `10` #1 | DELETE | S | backend-api-engineer | — | **G1.** Also a toll-fraud and false-evacuation vector |
| BE-021 | `POST/DELETE /api/sms-subscribe` plus page | `app/api/sms-subscribe/route.ts`; `app/sms-subscribe/page.tsx:48` | `10` #1 #3 | DELETE | S | backend-api-engineer, operator-ui | — | **G1, G3** |
| BE-022 | `POST /api/smart-alert` | `app/api/smart-alert/route.ts:122-141` fires SMS; SSRF via `cctv_source_url` (line 29) | `10` #1 #5 | DELETE | S | backend-api-engineer | — | **G1, G5.** The confidence score is ad hoc arithmetic (lines 67-95) |
| BE-023 | Operator notifier (WhatsApp group plus weekly email) | Not found. Twilio SDK dynamic import exists (`app/api/sms-alert/route.ts:135`) | `03` Notifier; `01` output channels; `10` #1 #17 | NEW | M | backend-api-engineer | BE-014, BE-005, gateway choice | One message per polder per 30 min unless the category changes; delivery log in `recommendations` |
| BE-024 | Chatbot (8 tools) | `app/api/chatbot/route.ts:47-60,175-199`; tools in `lib/api.client.ts:99-211` | `01` (CITYA is SCCIC's assistant); `10` #5 #7 #14 | PARK | M | backend-api-engineer | v1 API, BE-001 | `fetchWaterLevelData` presents replay as live; `fetchPumpStatusData` hits a missing route. Disable the public route now |
| BE-025 | `/api/ai-alerts` | `app/api/ai-alerts/route.ts:250-300` `Math.random()` stats; raw body logging (line 37) | `10` #5 | DELETE | S | backend-api-engineer | — | G5 |
| BE-026 | `/api/analysis` | `app/api/analysis/route.ts:8-46` open prompt proxy, no rate limit | none; `10` #14 | DELETE | S | backend-api-engineer | — | Cost abuse; error detail leak (line 63) |
| BE-027 | `/api/flood-analysis` | `app/api/flood-analysis/route.ts` (client-supplied data, `GOOGLE_API_KEY`) | none | DELETE | S | backend-api-engineer | — | |
| BE-028 | `/api/news-summary` | `app/api/news-summary/route.ts:20` relative fetch, broken | none | DELETE | S | backend-api-engineer | — | |
| BE-029 | `/api/alerts` plus `alerts` table | `app/api/alerts/route.ts`; `20250818110000_create_alerts_table.sql`; seed `supabase/seed.sql:75` | `10` #1; replaced by `recommendations` | DELETE | S | backend-api-engineer | — | G1 public alert feed; seed data |
| BE-030 | `/api/statistics/incidents` plus `historical_incidents` | `app/api/statistics/incidents/route.ts`; `20250818100000_...sql`; seed `supabase/seed.sql:68` (multi-hazard, multi-city sample rows) | `05` M1 uses `flood_reports` and BPBD data, not this | DELETE | S | backend-api-engineer | — | Seeded sample presented as statistics (G5) |
| BE-031 | Citizen flood reports | `app/api/flood-reports/route.ts:7-63` (SR, returns reporter PII publicly); `001_initial_schema.sql:17-29` (no RLS); browser anon write/read `app/flood-report/page.tsx:193-213`, `components/sensor-data/FloodReportList.tsx:69`; public bucket `laporan-banjir` | `03` `flood_reports` from S4/S15; `10` #3 | DELETE | M | backend-api-engineer, operator-ui | human approval for data purge | **G3.** If RLS is truly off, anon can also delete rows. Replace with the BPBD RT connector (data-ingestion) |
| BE-032 | Evacuation shelters | `app/api/evacuation/route.ts:21-30` (`Math.random` status, fabricated "verified_by"); `001_initial_schema.sql:2-71` | `02` D6; `01` non-goals | DELETE | S | backend-api-engineer | — | G5; named contact phones in seed (G3) |
| BE-033 | OSRM routing | `components/flood-map/EvacuationRouting.tsx:29` (leaflet-routing-machine, public OSRM demo server) | `02` likely outcome (routing out) | DELETE | S | operator-ui | BE-032 | Could return later for mobile-pump travel times; that would need a self-hosted OSRM |
| BE-034 | User preferences | `app/api/preferences/route.ts`; `user_preferences` not in migrations; no caller | none | DELETE | S | backend-api-engineer | — | |
| BE-035 | `predictions`, `detections` tables | `20250309000000_create_predictions_detections.sql` (INSERT `WITH CHECK (true)` with no role, so anon can write); unused by code | `03` `forecasts` | DELETE | S | backend-api-engineer | BE-018 | |
| BE-036 | Weather and AQI proxies | `app/api/weather/route.ts`, `app/api/dashboard/route.ts:36-40` (mocked forecast), `app/api/weather-history/route.ts` (paid OWM 3.0), `app/api/weather/tiles/[...tile]/route.ts`, `app/api/air-quality/route.ts:17-30` (canned AQI) | `02` likely outcome (general weather layers out); `04` S5 fallback is Open-Meteo, not OWM | DELETE | S | backend-api-engineer, operator-ui | — | G5, G14 |
| BE-037 | Rainfall input | `app/api/rainfall-dual/route.ts` (OWM point "rain.1h" at 2 coordinates) | `04` S5 BMKG nowcast; Open-Meteo labeled fallback; `03` `rain_products` | REBUILD | M | data-ingestion-engineer | BE-018 | Served via `/api/v1/observations` or forecasts with `source` |
| BE-038 | PetaBencana proxy | `app/api/disaster-proxy/route.ts` (real API; timeframe map bug at lines 15-19) | `04` S15; `03` connectors and `flood_reports` | REFACTOR | S | data-ingestion-engineer | BE-018 | Move into a scheduled connector; store raw payloads; no live proxy |
| BE-039 | `/api/disaster-reports` | `app/api/disaster-reports/route.ts:54-59` returns a simulated stub | `10` #5 | DELETE | S | backend-api-engineer | — | Upstash rate-limit and cache helpers stay (see BE-047) |
| BE-040 | CCTV scan | `app/api/cctv-scan/route.ts:26` fetches arbitrary URL (SSRF), no auth | `04` S12; `03` CCTV (VIANA preferred) | REBUILD | M | data-ingestion-engineer | S12 access | Allowlisted camera registry; scheduled snapshots to object storage |
| BE-041 | Visual verification | `app/api/verify-visual/route.ts`; FastAPI `/verify-visual` (`ml-service/src/main.py:263-288`); `ml-service/src/yolo_model.py` (Roboflow) | `03` CCTV analytics (VIANA or thin local detector) | PARK | M | hydro-ml-engineer | BE-040 | Uploads to third-party Roboflow; G4 if DSDA CCTV frames are ever sent |
| BE-042 | FastAPI service skeleton | `ml-service/src/main.py:21`, `ml-service/Dockerfile`, `ml-service/requirements.txt` | `03` Components: API "FastAPI (existing ML service can become this)" | REFACTOR | M | backend-api-engineer | BE-007, BE-001 | Keep app and Docker scaffolding; remove the model code; add auth dependency, CORS allowlist, DB layer |
| BE-043 | FastAPI demo "GOD MODE" admin | `ml-service/src/main.py:23-28,98-132,138-146,266-273` | `02` D4; `10` #5 | DELETE | S | backend-api-engineer | — | Secret in body; global state changes outputs for every user |
| BE-044 | FastAPI `/predict`, `/predict/scenario/{id}` | `ml-service/src/main.py:134-254,298-405`; `ml-service/models/training_results.json` | `02` D2, D3; `06` | DELETE | M | hydro-ml-engineer | — | G1 evacuation text; G5; G8 canned timestamps |
| BE-045 | Supabase client modules | Duplicates `lib/supabase/admin.ts` and `lib/supabaseAdmin.ts`; per-route SR clients (`app/api/sms-*/route.ts`); no `server-only` guard | `08` (RLS enforced) | REFACTOR | S | backend-api-engineer | BE-001 | One server-only admin client for jobs; user-scoped client for requests |
| BE-046 | Committed secrets | `scripts/seed-regions.mjs:9` hardcoded Supabase JWT, decoded role claim `service_role` (D10); `ml-service/src/yolo_model.py:48` hardcoded Roboflow API key fallback (D11) | `10` #10 | DELETE | S | platform-security | — | **G10.** Rotate first, then remove from code and history. The service_role key bypasses all RLS, so every table above is exposed while it stays valid |
| BE-047 | Rate limiting | `lib/simple-rate-limit.ts` (in-memory, per process); `src/lib/rateLimiter.ts` (Upstash) | `10` #17; API hardening | REFACTOR | S | backend-api-engineer | — | Keep one shared limiter for the API; separate notifier limiter per polder |
| BE-048 | MQTT publishing | Not found | `03` ISSP compatibility (`noah/v1/{polder_code}/nowcast`, `/status`, flag off by default) | NEW | S | backend-api-engineer | BE-011, BE-013 | Feature flag |
| BE-049 | Scheduler or cron | Not found (`vercel.json` has only rewrites; no workflow schedule) | `03` Connectors (APScheduler or cron); `10` #12 | NEW | M | data-ingestion-engineer | BE-018 | Stale over 15 min raises an alert |
| BE-050 | Webhooks for partners | Not found | `03` Components: API "webhooks" | NEW | S | backend-api-engineer | BE-007 | Signed, opt-in, authenticated partners only (never public) |
| BE-051 | Test routes | `app/api/test/route.ts`, `app/test/route.ts`, stray `app/api/test.css` | none | DELETE | S | backend-api-engineer | — | |
| BE-052 | Error handling | Stack traces in non-prod (`app/api/chatbot/route.ts:230-236`); `JSON.stringify(error)` (`app/api/analysis/route.ts:63`); upstream URL echoed (`app/api/disaster-proxy/route.ts:42`) | `03` OpenAPI error schema | REFACTOR | S | backend-api-engineer | BE-007 | |
| BE-053 | Deployment exposure | `docker-compose.yml` publishes ML port 8000 on the host; `vercel.json` suggests Vercel while the plan says VPS | `03` infrastructure (one VPS, containers); `10` #14 | REFACTOR | S | platform-security | — | Internal network only for FastAPI behind a reverse proxy |

## Route to v1 mapping

| Existing route | Target v1 endpoint | Relationship |
|---|---|---|
| GET /api/regions | `GET /api/v1/units?kind=` and `/units/{id}` | REBUILD (BE-008) |
| GET /api/water-level | `GET /api/v1/observations?station_id=&from=&to=` | REBUILD (BE-009) |
| GET /api/rainfall-dual | `GET /api/v1/observations` (ARR) / rain products through forecasts | REBUILD via connector (BE-037) |
| POST /api/predict | `GET /api/v1/forecasts`, `GET /api/v1/nowcast/current` | REBUILD (BE-011); method changes from POST compute to GET read |
| FastAPI POST /predict | same as above (M2 service writes `forecasts`) | DELETE (BE-044) |
| /api/pump-status (missing) | `GET /api/v1/polders/{id}/status` | NEW (BE-013) |
| POST /api/smart-alert, POST /api/sms-alert | `GET /api/v1/recommendations?status=open`, `POST /{id}/ack`, plus notifier | DELETE; replaced by NEW (BE-014, BE-023) |
| GET /api/alerts | `GET /api/v1/recommendations` | DELETE (BE-029) |
| GET /api/health, GET /api/ml-health, FastAPI GET /health | `GET /api/v1/health` | REFACTOR (BE-017) |
| GET /api/disaster-proxy | none directly; feeds `flood_reports` (M1 via `/scoreboard`) | REFACTOR into connector (BE-038) |
| POST /api/cctv-scan, POST /api/verify-visual, FastAPI /verify-visual | none in v1 (CCTV is supplementary) | REBUILD / PARK (BE-040, BE-041) |
| GET /api/scenarios, POST /api/scenarios/[id], FastAPI /scenarios, /predict/scenario/{id} | none (demo flag only) | PARK / DELETE (BE-012, BE-044) |
| (none) | `GET /api/v1/scoreboard` | NEW (BE-015) |
| (none) | `GET /api/v1/reports/weekly/{iso_week}` | NEW (BE-016) |
| All others: ai-alerts, air-quality, analysis, chatbot, dashboard, disaster-reports, evacuation, flood-analysis, flood-reports, news-summary, preferences, sensor-simulator, sms-subscribe, statistics/incidents, test, weather, weather/tiles, weather-history, /test, FastAPI `/`, `/admin/*` | none | DELETE or PARK (chatbot) |

## Guardrail violations found (all must become W1 backlog items)

| Guardrail | Evidence | Row |
|---|---|---|
| 1 No public warnings | Citizen SMS (`app/api/sms-alert/route.ts:157-161`), public subscription (`app/api/sms-subscribe/route.ts`, `app/sms-subscribe/page.tsx`), auto SMS trigger (`app/api/smart-alert/route.ts:122-141`), evacuation text from FastAPI (`ml-service/src/main.py:144`, 225, 314, 374) relayed by `/api/predict` and `/api/scenarios/[id]`, public `alerts` feed | BE-019 to BE-022, BE-029, BE-044 |
| 3 Personal data | Anon-readable phones and names (`20250309100000_create_sms_subscribers.sql:48-49`, 59-61); reporter name and contact served publicly (`app/api/flood-reports/route.ts:14-17`; browser `components/sensor-data/FloodReportList.tsx:69`); citizen photos in a public bucket; named contact phones in `001_initial_schema.sql` seed | BE-019, BE-031, BE-032 |
| 5 No fake data | Replay as live (`app/api/water-level/route.ts:74,92`), `Math.random` (`sensor-simulator:49-65`, `evacuation:21-30`, `ai-alerts:258-281`), canned AQI (`air-quality:17-30`), mocked forecast (`dashboard:36-40`), stub (`disaster-reports:54-59`), god mode (`main.py:138-146`), default 300 cm (`predict:33`) | BE-009 to BE-012, BE-025, BE-030, BE-032, BE-036, BE-039, BE-043 |
| 7 Provenance | No route returns source, station or model version with a real timestamp; the chatbot answers without provenance | BE-007, BE-024 |
| 8 Units and time | Replay indexed on server-local `getHours()`/`getDate()` (`water-level:48-51`, `sensor-simulator:69-73`); canned `2025-11-25T10:00:00Z` (`main.py:145`, 272, 315) | BE-009, BE-010, BE-044 |
| 10 Secrets | service_role JWT (`scripts/seed-regions.mjs:9`); Roboflow key (`ml-service/src/yolo_model.py:48`) | BE-046 |
| 14 Budget | Gemini, a different LLM vendor from the budgeted Anthropic API (`app/api/chatbot`, `ai-alerts`, `analysis`, `flood-analysis`); paid OWM One Call 3.0 (`weather-history:25`); Twilio paid | BE-024 to BE-027, BE-036, BE-020 |

Not violated: Guardrail 2 (no SCADA, pump or gate writes found). Guardrail 6 has no existing fact tables to protect, so it applies to BE-018. Guardrail 17 has no operator messaging yet, so it applies to BE-023.

Security findings that are not guardrails but block go-live:
- SSRF in `/api/cctv-scan` and `/api/smart-alert`.
- Unauthenticated LLM proxies (cost abuse).
- Anon INSERT on `predictions` and `detections`.
- Possible anon full CRUD on `laporan_banjir` and `evacuation_locations` (RLS not enabled).
- CORS `*` on `/api/regions`.
- FastAPI admin secret compared in the request body.

## Reuse map (backend)
- FastAPI app, Dockerfile and compose service → v1 API host (BE-042).
- `@supabase/ssr` server and browser clients → the Supabase Auth provider behind the OIDC adapter (BE-001, BE-045).
- `src/lib/rateLimiter.ts` plus `src/lib/redis.ts` (Upstash), `src/lib/requestId.ts`, `src/lib/logger.ts`, Sentry wiring in `app/api/disaster-reports/route.ts` → API middleware (BE-047).
- `lib/schemas.ts` (zod) pattern → request validation for ack and corrections.
- PetaBencana fetch logic → S15 connector (BE-038).
- `sms_logs` shape (status, provider id, error) → delivery fields on `recommendations` (BE-023).

## Open questions

| # | Question | Who can answer |
|---|---|---|
| 1 | What is the live Supabase state? A schema-only dump plus `pg_policies` is needed to confirm drift: RLS on `laporan_banjir` and `evacuation_locations`, the region tables, `user_preferences`, the `laporan-banjir` bucket policy | Ari |
| 2 | Has `/api/sms-alert` ever sent to real residents? How many rows are in `sms_subscribers` and `laporan_banjir`? What purge and notice process do we follow under UU PDP before dropping them? | Ari |
| 3 | Has the service_role key from `scripts/seed-regions.mjs:9` been rotated? Until it is, every table is exposed regardless of RLS | Ari / platform-security |
| 4 | Do we keep Supabase as the managed Postgres/PostGIS and first auth provider, or move to plain managed Postgres plus a local Keycloak from day one? | Ari, SCCIC |
| 5 | What are the ISSP Keycloak realm, client and role-claim conventions, so the adapter maps roles correctly? | SCCIC |
| 6 | Which WhatsApp gateway (paid, Guardrail 14) and which DSDA group? Is email needed for the weekly report only? | Ari, DSDA |
| 7 | Is the v1 API hosted only in FastAPI (per `03`), with Next.js as a pure UI client, or do some reads stay as Next.js route handlers? | Ari |
| 8 | Is deployment Vercel (`vercel.json`) or the VPS from `03`? This decides how the scheduler and internal networking work | Ari |
| 9 | Is the Gemini key still active, and should it be revoked once the chatbot is parked? | Ari |
| 10 | Will CCTV snapshot URLs (S12) come with a fixed host allowlist? Can frames be sent to Roboflow under the PKS (Guardrail 4)? | DSDA, Diskominfotik |
