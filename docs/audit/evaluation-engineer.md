# Audit: evaluation-engineer (Phase A, Module 1 scope)

Scope: everything resembling forecast logging, prediction storage, metrics, evaluation, backtesting, training metrics, accuracy claims, alert logs, tests and CI, and historical data that could seed an M1 backtest. Compared against `docs/plan/05_MODULE_1_EVALUATION.md`, `03_TARGET_ARCHITECTURE.md` (forecasts, event_definitions, verifications), `09_ROADMAP_AND_ACCEPTANCE.md`, `10_GUARDRAILS.md`.

Audit mode, read-only. No application code was changed. Line numbers verified on 2026-11-02.

## Summary

- **No M1 capability exists.** There is no forecast log, no event definition, no matching, no verification table, no POD/FAR/CSI/Brier/lead-time code, no scoreboard, no weekly report, and no backtest harness.
- **One unused prediction table.** `predictions` (`supabase/migrations/20250309000000_create_predictions_detections.sql`) is never written by any code path (grep across `app/`, `lib/`, `components/`, `src/`, `hooks/`, `ml-service/src/`). It lacks `issued_at`/`valid_from`/`valid_to`/`lead_min`/`model_version`/`unit_id`/`probability`. Its INSERT policy has no role restriction, so the anon key can insert rows (lines 43-44).
- **Nothing is enforced as append-only.** No triggers, no `REVOKE UPDATE, DELETE`, and `service_role` bypasses RLS. `sms_logs` grants `FOR ALL` to service_role. `historical_incidents` is designed for in-place update (`updated_at`). There are currently no update/delete code paths on prediction data, but only because nothing writes it.
- **The training metrics are misleading on every axis (guardrail 9):**
  - R2 = -0.41 is reported.
  - "Accuracy" 0.936 with flood recall 0/9 is exactly the base rate (131/140).
  - Errors are in decimetres but are labelled or treated as cm.
  - The plot claims "MAE: 0.68cm" and contradicts the JSON (MAE 5.77).
  - No baseline (persistence or climatology) is reported anywhere.
  - There is no training script in the repo or in git history (`git log --all`), so the numbers cannot be reproduced.
- **Unit and data-corruption defects affect any reuse:**
  - `DATASET_FINAL_TRAINING.csv` `tma_manggarai` is in dm (raw mm / 100). Example: Manggarai 2020-01-01 02:40 raw 7960 → dataset 76.55 hourly mean. `app/api/water-level/route.ts` serves it as `water_level_cm`, a factor-10 error.
  - In `preprocessed_data.csv` the timestamp column was overwritten by `floor(hujan_bogor)` as epoch-ns (1970-01-01 ...). Rows are sorted by Bogor rain rather than time, and hour, month and day are constant (0, 1, 1).
- **Alert log = Twilio `sms_logs` only.** It has no link to a forecast and records SMS sent to residents (guardrail 1). It is publicly readable with phone numbers (guardrail 3).
- **Tests and CI:**
  - The only test that runs locally is `lib/utils.test.ts` (3 cases on `formatNumber`).
  - `tests/smoke/app.spec.ts` is not matched by the vitest `include` (`**/*.test.ts(x)`), so it never runs.
  - There is no pytest anywhere.
  - CI (`.github/workflows/ci.yml`) runs only `tsc --noEmit` and `next build`. No tests and no secret scan.
- **Backtest seed available:**
  - `ml-service/data/tma_2020.xlsx.csv` covers 21 DSDA posts at 30-minute intervals, 2019-12-31 23:40 to 2020-01-31 23:10. It includes a `status_siaga` column with 538 status transitions and covers the 1 January 2020 flood.
  - It is enough to backtest the DSDA Siaga source and a level baseline as forecasts.
  - **No observed flood events (BPBD RT reports, S4) for that period exist in the repo**, so POD/FAR/CSI cannot be computed until the S4 archive (or another event record) is obtained.

### Decision counts (28 rows)
| KEEP | REFACTOR | REBUILD | NEW | DELETE | PARK |
|---|---|---|---|---|---|
| 1 | 3 | 2 | 9 | 11 | 2 |

### Guardrail violations found
- **#1:** SMS to residents.
  - `app/api/smart-alert/route.ts:122-139` triggers `app/api/sms-alert/route.ts`, logged in `sms_logs`.
  - The "EVAKUASI SEGERA" text comes from `ml-service/src/main.py:144,225` and `app/api/smart-alert/route.ts:99`.
- **#3:** Phone numbers are publicly readable.
  - `supabase/migrations/20250309100000_create_sms_subscribers.sql:183-184,194-196`.
  - Citizen `reporter_contact` in `laporan_banjir` (`supabase/migrations/001_initial_schema.sql:17-30`).
- **#5:** Fake or replayed data presented as forecasts or risk. See EV-009, EV-016, EV-017, EV-019 and EV-020.
- **#6:** No append-only enforcement on any fact table. The `predictions` insert policy is open to anon.
- **#7:** Predictions carry no model version or input timestamps. The demo response is stamped with a fixed `2025-11-25T10:00:00Z` (`ml-service/src/main.py:145,272,315`).
- **#8:** dm/cm unit error (EV-009). The archive time zone is undocumented (EV-011).
- **#9:** R2 and accuracy are reported, there is no baseline, and "confidence" is uncalibrated (see the misleading-claims list).
- **#10:** No secret scan in CI.
- **#11:** Tests do not run in CI and there are no matching tests.

## Inventory and decisions

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| EV-001 | Forecast store | `supabase/migrations/20250309000000_create_predictions_detections.sql:2-13` defines `predictions(prediction_cm, risk_level, source[manual\|auto\|scenario], created_at)`. No issued/valid window, lead, model_version, unit_id or probability. Never written by any code. Lines 39, 43-44: public SELECT, and INSERT `WITH CHECK (true)` with no `TO` role, so anon can insert | `03` data model `forecasts(...)` append-only, immutable; `05` "Every stored forecast is immutable and carries issued_at, valid_from, valid_to, unit_id, probability or category, model_version" | REBUILD | M | evaluation-engineer (with backend) | Target schema migration (W1) | Drop the legacy table once `forecasts` exists. Guardrails **6, 7** |
| EV-002 | Append-only enforcement | Not found. No `REVOKE UPDATE/DELETE`, no BEFORE UPDATE/DELETE triggers in `supabase/migrations/*`. `sms_logs` service_role `FOR ALL` (`20250309100000_create_sms_subscribers.sql:191-192`). `historical_incidents.updated_at` (`20250818100000_...sql:76`) implies in-place edits. Update calls exist only on preferences/subscribers (`app/api/sms-subscribe/route.ts:81,140`, `app/api/preferences/route.ts:67`) | `03` "All tables that represent facts in time are append-only; corrections are new rows with supersedes_id"; `10` #6 | NEW | S | evaluation-engineer | EV-001, EV-005 | DB-level guard: revoke UPDATE/DELETE from all roles including the app role, plus a trigger that raises on UPDATE/DELETE, for forecasts, verifications, observations, flood_reports, pump_states. Add a test that attempts an UPDATE and expects failure. Guardrail **6** |
| EV-003 | Forecast logging at issue time | Predictions are returned but never logged: `app/api/predict/route.ts:67-74`, `ml-service/src/main.py:135-260` (`/predict`), `:298-405` (`/predict/scenario`), `app/api/smart-alert/route.ts:105-119`. No `model_version`/`issued_at`/`lead_min` anywhere in `app/`, `lib/`, `ml-service/src`, `supabase/` (grep: none) | `05` sources table (Noah M2, baseline, DSDA Siaga, BMKG); `06` acceptance "outputs written to forecasts … model_version and input timestamps" | NEW | M | evaluation-engineer + hydro-ml | EV-001 | Writer library used by M2, the baseline job and connector-derived sources (Siaga, BMKG). Idempotency key (source, model_version, unit_id, issued_at, lead_min). Guardrails **6, 7** |
| EV-004 | Event definitions | Not found | `05` "Event definition (version 1)"; `03` `event_definitions(version, description, rule jsonb, agreed_with, valid_from)` | NEW | S | evaluation-engineer | EV-014; sign-off DSDA/BPBD | Store v1 with `agreed_with = NULL` until confirmed; every metric output states the version |
| EV-005 | Matching engine and verifications | Not found (no hit/miss/false-alarm logic anywhere) | `05` Matching (threshold 0.5 configurable; hit/false alarm/miss/correct negative; lead time; nightly 72 h re-match, append-only, latest `computed_at` wins); `03` `verifications` | NEW | M | evaluation-engineer | EV-001, EV-004, EV-014 | Table-driven tests: late reports, overlapping windows, boundary times (inclusive/exclusive `valid_to`), multiple positives per event, reports straddling hour boundaries. Guardrails **6, 11** |
| EV-006 | Metrics module | `ml-service/src/metrics.py:14-56` (RMSE, MAE, MAPE, R2), `:58-82` (`risk_accuracy`, macro precision/recall). `:65` thresholds `SIAGA_1: 150, SIAGA_2: 100` "Contoh threshold Manggarai" (official 750/850/950 cm) | `05` Metrics (POD, FAR, CSI, frequency bias, Brier, reliability, lead-time distribution); "Never report accuracy or R2" | DELETE | S | evaluation-engineer | none | Replace with M1 metrics (plain numpy/pandas or xskillscore per `03`). Guardrails **9**, D12 |
| EV-007 | Training metrics file | `ml-service/models/training_results.json`. `:19` r2 -0.412. `:32` accuracy 0.9357 with `:31` recall 0.0, `:34-37` 9 true floods, 0 predicted. `:16-27` regression errors in dm (target `tma_manggarai`, `:231`). `:213-215` non-chronological split risk (see EV-010). Committed only in "First Commit" `5f0fa0e`; no training script in repo or history | `05` Metrics; `10` #9; `02` D2 | DELETE | S | evaluation-engineer | none | Keep a copy only as audit evidence for D2 if wanted (e.g. quoted in GAP_REPORT), not as a model artifact. Guardrail **9** |
| EV-008 | Training plot | `ml-service/models/training_accuracy_plot.png` titled "Flood Model Evaluation (MAE: 0.68cm)", y-axis "Water Level (cm)" with values 55-82 (actually dm). Contradicts JSON MAE 5.77. Prediction visibly lags actual by about 1 step (persistence-like) with no persistence baseline | `10` #9 "Report baseline next to every model" | DELETE | S | evaluation-engineer | none | Guardrail **9** |
| EV-009 | Training dataset / replay source | `ml-service/data/DATASET_FINAL_TRAINING.csv`: 744 hourly rows, 2020-01-01 00:00 to 2020-01-31 23:00, columns `hujan_bogor, hujan_jakarta, tma_manggarai` (55.15-96.75 = dm). Served as live `water_level_cm` with `timestamp: now()` by `app/api/water-level/route.ts:45-80` (D1) | `04` S2; `05` acceptance backtest; `10` #5, #8 | PARK | S | data-ingestion-engineer | EV-011 | Usable only as a backtest fixture after conversion to cm and documented provenance (rain source unknown). Never as live data. Guardrails **5, 8** |
| EV-010 | Preprocessed features | `ml-service/models/preprocessed_data.csv` (720 x 62): `timestamp` = `1970-01-01 00:00:00.00000000N` where N = floor(hujan_bogor) for 100% of rows; rows sorted by it (595 rows bucket 0 ... 1 row bucket 17); `hour`, `month`, `day_of_month` constant. Cause: `ml-service/src/preprocessing.py:107-112` renames the first column to `timestamp` and sorts | `06` build order (features from history); `10` #8 | DELETE | S | hydro-ml-engineer | none | Any metric computed from this is invalid. The test split is mostly rainy hours out of time order |
| EV-011 | DSDA TMA archive (S2 subset) | `ml-service/data/tma_2020.xlsx.csv`: 31,059 rows, 21 posts (Katulampa, Depok, Manggarai, Karet, Marina, Pasar Ikan, Pluit, Sunter Hulu, Pulo Gadung, Cipinang Hulu, Angke Hulu, Pesanggrahan, Krukut Hulu, Istiqlal, Jembatan Merah, Ancol Flushing, Hek, Cideng, Yos Sudarso 1, Kali Duri, Cibalok), 1,479 rows each. Coverage 2019-12-31 23:40 to 2020-01-31 23:10 (one stray 2019-12-23 row), 30 min step. `tinggi_air` in mm (Manggarai 4,870-9,690 = 487-969 cm). `status_siaga` Normal 25,533 / Siaga 3 2,830 / Siaga 2 2,118 / Siaga 1 578; 538 transitions. Manggarai first Siaga 3 at 2020-01-01 02:40 (796 cm), consistent with the official >750 cm. Not used by any code | `05` acceptance "Backtest on any available archive (S2, S3, S4 archive)"; `04` S2 | KEEP | S | evaluation-engineer | EV-012 not needed; EV-014 for events | Seeds backtest of the `dsda_siaga` source (status change = alert) and a persistence/level baseline. Time zone not stated (likely WIB; confirm). Coastal posts (Istiqlal, Pasar Ikan, Marina) sit in Siaga for long tidal periods, so the post-to-polder mapping must handle that. Siaga 1/2 on 2020-01-01 at 11 posts. Guardrail **8** |
| EV-012 | Bogor rainfall series | `ml-service/data/hujan_bogor2022.csv`: 17,544 hourly rows, 2022-01-01 00:00 to 2024-01-01 23:00, header `time,precipitation (mm)` (Open-Meteo archive export format; reanalysis, not a gauge). Not used by code. No overlap with EV-011 (2020) | `04` S5 fallback (Open-Meteo, label clearly); `06` baseline features | PARK | S | data-ingestion-engineer | provenance note | Cannot pair with any water-level or event data in repo. Guardrail **7** |
| EV-013 | Empty dummy files | `ml-service/data/floodgauges_dummy.json`, `ml-service/data/rainfall_dummy.json` (0 bytes each) | none | DELETE | S | repo-auditor | none | |
| EV-014 | Observed flood events (ground truth) | Not found: no BPBD RT reports (S4), no connector. `laporan_banjir` (`supabase/migrations/001_initial_schema.sql:17-30`) holds citizen point reports with `reporter_name`/`reporter_contact`, no RT code or depth definition. `historical_incidents` seed (`supabase/seed.sql:66-70`) has 3 hand-written rows (one Jakarta flood, 2024-01-15) | `03` `flood_reports` append-only; `04` S4, S15; `05` event definition | NEW | M | data-ingestion-engineer + evaluation-engineer | S4 archive request | Without S4 (or PetaBencana archive) for Jan 2020, the EV-011 backtest can only produce forecast logs, not POD/FAR/CSI. Guardrails **3, 6** |
| EV-015 | "Smart alert" confidence | `app/api/smart-alert/route.ts:64-95` additive heuristic (CRITICAL +0.5, BAHAYA +0.4, WASPADA +0.25, AMAN +0.05, +0.4 x YOLO prob), output as `confidence` (`:107`). Not logged. Triggers SMS (`:122-139`) | `05` probabilistic sources need Brier and reliability; `06` M2 replaces it | DELETE | S | hydro-ml-engineer | M2 baseline | An uncalibrated score labelled confidence. Guardrails **1, 9** |
| EV-016 | Client risk "forecast" widget | `components/tiling/FloodRiskForecast.tsx:113` risk = 0.5 x status + 0.3 x proxy(status) + 0.2 x CCTV, shown as % (`:161,179`) under "LIVE" (`:147`). Hardcoded fallback stations (`:97-103`, incl. Manggarai 850 cm "Siaga 3"). Label `src/i18n/id.ts:772` / `en.ts:772` says "LSTM (50%)" but no LSTM is used | `06` M2 probabilities from `forecasts`; `08` Ringkasan page | DELETE | S | operator-ui-engineer | EV-003 | Guardrails **5, 7, 9** |
| EV-017 | Statistics page numbers | `app/statistics/components/StatistikOverview.tsx:116-170` hardcoded stat cards (incl. `:163` "85%" preparedness "Skor nasional"). `:593` "+15%", `:649` "-8%", `:676` "85%" under "AI Insights … berbasis machine learning" (`src/i18n/id.ts:484-485`). Pie data `:100-106` hardcoded | `08` Skor page (M1 metrics with plain-language explanations) | DELETE | S | operator-ui-engineer | EV-023 | Guardrails **5, 7** |
| EV-018 | Alert log (Twilio) | `sms_logs` (`supabase/migrations/20250309100000_create_sms_subscribers.sql:155-166`): phone, message, alert_level, status, twilio_sid. No forecast_id or valid window. Written by `app/api/sms-alert/route.ts:164-187`. Public SELECT (`:194-196`) exposes phone numbers. service_role `FOR ALL` (mutable) | `03` `recommendations(forecast_id, …, sent_at, channel, ack_by, ack_at, operator_action)`; `10` #1, #3 | DELETE | S | platform-security | none | Rebuild operator message logging as `recommendations` linked to `forecasts`. Guardrails **1, 3, 6** |
| EV-019 | Seeded alerts served as real | `supabase/seed.sql:75-90` fabricated alerts (e.g. `:78` Manggarai 850 cm labelled "Siaga 3"; official Siaga 2 >850, Siaga 3 >750), read by `app/api/alerts/route.ts:14` | `05` sources must be retrievable with timestamps; `10` #5 | DELETE | S | backend-engineer | none | Must never be imported as `dsda_siaga` forecasts. Guardrail **5** |
| EV-020 | Random risk time series | `app/api/ai-alerts/route.ts:277-282` `timeSeriesData` with `riskLevel: Math.floor(Math.random() * severity) + 1` | `10` #5 | DELETE | S | platform-security | none | Guardrail **5** |
| EV-021 | Tests | `lib/utils.test.ts` (3 cases, `formatNumber`). `tests/smoke/app.spec.ts` (`expect(true)`) is excluded by `vitest.config.ts:14` include pattern, so it never runs. No pytest, no `conftest.py`, pytest absent from `ml-service/requirements.txt` | `05` acceptance "Unit tests for matching on hand-made cases"; `10` #11 | REBUILD | M | qa-verifier + evaluation-engineer | EV-005 | Add a pytest suite for M1 (matching table tests, metric formulas against hand-computed contingency tables, Brier edge cases, append-only DB test). Guardrail **11** |
| EV-022 | CI | `.github/workflows/ci.yml:25-31` runs `npm ci`, `tsc --noEmit`, `npm run build` only. No `npm test`, no Python job, no secret scan | `09` W1 "CI runs tests"; `10` #10, #11 | REFACTOR | S | platform-security | EV-021 | Add vitest, pytest (ml/eval service) and gitleaks jobs; fail on any. Guardrails **10, 11** |
| EV-023 | Scoreboard API and Skor page | Not found (`/api/v1/scoreboard` absent; no `/metrics` endpoint in `ml-service/src/main.py` despite docs) | `03` API `GET /api/v1/scoreboard?from=&to=&source=&lead=`; `05` Outputs; `08` Skor | NEW | M | evaluation-engineer + operator-ui-engineer | EV-005 | Per source, polder, lead bucket (60/120/180), week and cumulative; always shows event-definition version and baseline row |
| EV-024 | Weekly report | Not found | `05` weekly report Monday 07:00 WIB, Bahasa Indonesia, plain-language metric explanations; `03` `GET /api/v1/reports/weekly/{iso_week}` | NEW | M | evaluation-engineer | EV-023 | Internal only. Guardrail **15** |
| EV-025 | Baseline source | Not found (no persistence, climatology or rainfall-threshold reference anywhere) | `06` step 2 baseline logged as `baseline` forever; `10` #9 | NEW | M | hydro-ml-engineer | EV-003, rain + level history | Required next to every model in every metric table. Guardrail **9** |
| EV-026 | Accuracy and capability claims in docs/UI | See "Misleading metric claims" below (README, `documentation/`, `public/about.html`, education pages) | `10` #9; `01` scope | REFACTOR | S | qa-verifier | none | Rewrite README and docs to state "no validated forecast skill yet"; remove horizon claims until M1 shows them. Guardrails **1, 9** |
| EV-027 | Risk categories used as forecast categories | `ml-service/src/main.py:223-234` (850/700/400 cm, duplicated `:372-383`); `ml-service/src/metrics.py:65` (150/100) | `04` station config (Manggarai 750/850/950); `02` D12 | REFACTOR | S | data-ingestion-engineer | station config | M1 must read categories and thresholds from station config so DSDA Siaga and Noah are judged by the same definitions |
| EV-028 | Backtest harness | Not found | `05` acceptance "Backtest on any available archive (S2, S3, S4 archive) produces metrics without errors"; `06` acceptance backtest report | NEW | M | evaluation-engineer | EV-004, EV-005, EV-011, EV-014 | Replays archived observations through the forecast writers with `issued_at` = archive time, tagged `backtest=true` / separate run id so it never mixes with live M1 metrics |

## Misleading metric and capability claims (guardrail 9 unless noted)

1. `ml-service/models/training_results.json:19`: `"r2": -0.412`. R2 is reported for a flood problem, and it is negative (worse than predicting the mean).
2. `ml-service/models/training_results.json:32`: `"accuracy": 0.9357` alongside `:31` recall 0.0 and `:34-37` 9 true / 0 predicted / 9 missed. The accuracy equals the no-flood base rate (131/140).
3. `ml-service/models/training_results.json:16-27`: RMSE 8.88 / MAE 5.77 have no units and are in dm (about 89 / 58 cm). No persistence baseline is reported.
4. `ml-service/models/training_accuracy_plot.png` (title): "MAE: 0.68cm" on a dm axis labelled cm. It conflicts with the JSON. The filename calls it "accuracy", and the curve is persistence-like with no baseline.
5. `ml-service/src/metrics.py:41,52` computes R2. `:78` computes `risk_accuracy`. `:65` uses Manggarai "thresholds" of 150/100 cm.
6. `app/api/smart-alert/route.ts:64-95,107`: a heuristic score is exposed as `confidence`. Repeated as "high-confidence flood alerts" in `README.md:53,146,165,178,280,342`, `documentation/THEME_FIT_ANALYSIS.md:56,119`, `documentation/SMS_ALERT_PLAN.md:166` and `documentation/NOAH_AI_INTEGRATION_PLAN.md:190`.
7. `components/tiling/FloodRiskForecast.tsx:147,161,179`: "LIVE" risk % comes from status heuristics or the hardcoded fallback (`:97-103`). `src/i18n/id.ts:772` and `src/i18n/en.ts:772` attribute 50% to "LSTM". `README.md:343` repeats the formula.
8. `app/statistics/components/StatistikOverview.tsx:163,593,649,676`: hardcoded "85%", "+15%", "-8%", "85%" presented as "AI Insights … berbasis machine learning" (`src/i18n/id.ts:484-485`). Guardrails 5, 7.
9. `README.md:51,62,95,315`: "LSTM … predicts water levels ahead of time" and "trained on Manggarai 2020", with no disclosure of R2 -0.41 or 0/9 recall, and serving uses 3 of 62 features (`ml-service/src/main.py:170-171`).
10. `documentation/NOAH_AI_INTEGRATION_PLAN.md:275`: "predicts floods 24 hours ahead". The model is a 1-step hourly regressor and has never been verified.
11. `public/about.html:210-211`: "memprediksi kenaikan muka air 3-6 jam ke depan". The horizon is unsupported.
12. `documentation/FEATURES.md:892` and `documentation/PROJECT_OVERVIEW.md:90`: "GET /metrics — Model performance metrics". The endpoint does not exist in `ml-service/src/main.py`. Also `documentation/FEATURES.md:661,676-677`.
13. `app/education/panduan-siaga-banjir/page.tsx:50`: "Bisa diprediksi dengan akurat" (unqualified accuracy claim).
14. `app/education/teknologi-monitoring-banjir/page.tsx:71`: hardcoded "SENSORS_ACTIVE: 98%". Guardrail 5.
15. `ml-service/src/main.py:52`: logs "REAL AI LOADED: LSTM Neural Network Active", although inference at `:171` feeds a 3-feature array to a 62-feature model and silently falls back (`:175-177`). The response does not say a fallback was used.
16. `src/i18n/id.ts:684` and `src/i18n/en.ts:684`: "data ketinggian air live (historical replay …)" calls a replay "live". Guardrail 5.

## Backtest data available in repo

| File | Content | Time coverage | Use for M1 | Gap |
|---|---|---|---|---|
| `ml-service/data/tma_2020.xlsx.csv` | 21 DSDA posts, level (mm) + Siaga status, 30 min | 2019-12-31 23:40 to 2020-01-31 23:10 | `dsda_siaga` forecasts (status changes) and a level/persistence baseline; covers the 1 Jan 2020 flood (Siaga 1/2 at 11 posts) | No event truth; time zone undocumented; 1 month only |
| `ml-service/data/DATASET_FINAL_TRAINING.csv` | Hourly Bogor rain, Jakarta rain, Manggarai level (dm) | 2020-01-01 00:00 to 2020-01-31 23:00 | Rain inputs for a rain-threshold baseline backtest on Jan 2020 | Rain source undocumented; units must be fixed |
| `ml-service/data/hujan_bogor2022.csv` | Hourly Bogor precipitation (Open-Meteo format) | 2022-01-01 to 2024-01-01 | Rain climatology for baseline thresholds only | No level or event data for the same period |
| BPBD RT flood reports (S4), DSDA 5-min archive (S3) | not found | n/a | Required for POD/FAR/CSI | Must be requested |

Conclusion: the repo supports a **forecast-side** backtest (DSDA Siaga and baseline, January 2020) but not verification. It does not meet the `05` acceptance criterion "backtest … produces metrics" until an event record for January 2020 (S4 archive, or PetaBencana or BNPB DIBI as a documented interim) is loaded.

## Open questions

1. **Event definition v1 sign-off** (DSDA, BPBD). Who signs `agreed_with`, and by when in W1? Is ">= 10 cm at >= 1 RT in hour h" acceptable to both?
2. **Polder versus kelurahan unit** (DSDA). Which unit does M1 score for Siaga alerts? The post-to-polder/kelurahan mapping table is needed, and coastal posts with tidal Siaga need a rule.
3. **S4 archive** (BPBD). Can BPBD provide RT reports with start/end time and depth for January 2020 and the 2024-2026 wet seasons? What is the late-report latency, to confirm the 72 h re-match window is enough?
4. **Archive time zone and units** (DSDA). Is `tma_2020.xlsx.csv` `tanggal` WIB? Is `tinggi_air` in mm relative to post datum?
5. **Siaga as a forecast** (DSDA, Ari). What `valid_from`/`valid_to` window and lead should a Siaga status change carry for each downstream unit? Without one, Siaga cannot be scored on lead time.
6. **Decision thresholds** (Ari, SCCIC). Is 0.5 the default positive threshold for all sources, and which threshold set goes in the threshold sweep report?
7. **Legacy artifacts** (Ari). Should `training_results.json` and the plot be kept anywhere as D2 evidence, or removed outright?
8. **Historical forecasts from other sources** (BMKG, DSDA). Are archived BMKG nowcasts or JaWaRA outputs with timestamps available? If not, they can only be scored from the go-live date forward.
9. **Backtest isolation** (SCCIC, Ari). Should backtest forecasts live in the same `forecasts` table with a run id, or in a separate schema? The plan does not specify. Recommendation: same schema, separate `run_id`, excluded from live scoreboard by default.
