# Audit: hydro-ml-engineer (Phase A)

Scope: `ml-service/` (FastAPI app, model artifacts, data, Dockerfile), every Next.js caller of the ML service, the CV/YOLO path, and any geo, polder, or pump code (D8). Audit only: nothing was trained, installed, or executed. Model weights and pickles were **not loaded**. I read HDF5 headers with `strings` and the joblib pickles with `pickletools.dis` plus raw byte reads; neither runs code.

Line numbers are from the working tree on 2026-11-02 (HEAD `49a23e3`).

GPU hours used: 0.

## Summary

- **Service:** FastAPI 1-file app `ml-service/src/main.py` (409 lines) plus `lstm_model.py` (241), `preprocessing.py` (149, truncated), `metrics.py` (81), `scenarios.py` (65), `yolo_model.py` (190). The service has no tests, and CI (`.github/workflows/ci.yml:26-32`) runs only `npm ci`, `tsc`, and `build`.
- **Forecast core:** no part of it is usable. The LSTM is a mis-wired artifact. Its "physics engine" is an uncalibrated formula. GOD MODE and the scenarios return canned values. Outputs carry no model version or issue time and are never persisted.
- **CV:** this is not YOLO running locally. Images go to a Roboflow cloud workflow, and the code falls back to a committed API key. The local `yolov8n.pt` weights are never used for inference.
- **D8:** confirmed. There is no DEM, HAND, polder, water-balance, or pump logic anywhere in the repository.
- **Reusable:** the FastAPI app shape and health-endpoint pattern, the multi-stage Python Dockerfile and compose wiring (both after cleanup), the raw Open Data TMA file `tma_2020.xlsx.csv` as a backtest seed, and the feature ideas (not the code) for the M2 baseline.
- **Decision counts (35 rows):** KEEP 1 · REFACTOR 5 · REBUILD 3 · NEW 10 · DELETE 15 · PARK 1.

## Inventory and decisions

| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| ML-001 | FastAPI app skeleton | `ml-service/src/main.py:1-95`: app titled "Jakarta FloodNet API Gateway" (:21), path hack (:17-18), `/` (:82-84), `/health` (:86-95) reporting `lstm_ready`/`vision_ready` and DEMO/LIVE mode | `03_TARGET_ARCHITECTURE.md` Components "API" and "API (v1)"; `/api/v1/health` per-connector freshness | REFACTOR | M | backend-engineer (with hydro-ml-engineer) | DB schema (`03` data model) | Keep FastAPI and its OpenAPI generation. Drop global model loading at import time (:42-70) and the model-centric health check. Health must report connector freshness (G12). M2 and M3 run as scheduled workers that write to `forecasts`; the API only reads |
| ML-002 | `POST /predict` | `main.py:134-260`. Inputs `water_level_cm`, `rainfall_*` (:74-78). Returns HTTP 200 even on error with `prediction_cm` 0 or the current level (:159-161, :243-251). Public text "EVAKUASI SEGERA" (:225). No `model_version` or `issued_at` in the response (:236-241). Unreachable fallback (:253-260) | `06_MODULE_2_IMPACT_NOWCAST.md` build order; `03` `GET /api/v1/nowcast/current` | DELETE | S | hydro-ml-engineer | ML-029 replacement | G1 (evacuation wording reaches public pages), G5, G7, G12 (errors hidden behind HTTP 200). See D2 and D3 |
| ML-003 | LSTM artifacts | `models/lstm_flood_forecaster.h5` (408,040 B, HDF5; config `batch_shape [null,12,3]`, 2 LSTM layers, 2 Dense, no BatchNorm). `models/lstm_model.h5` (154,968 B, HDF5, `[null,1,3]`, LSTM(50)). `lstm_scaler_X.pkl` (799 B, MinMaxScaler, `n_features_in_`=3). `lstm_scaler_y.pkl` (719 B, 1 feature). `scaler.pkl` (799 B, same as scaler_X). `lstm_scaler_features.pkl` (1,275 B, list of 60 feature names). `preprocessed_data.csv` (386,667 B, 720 rows). All sklearn 1.7.2 pickles | `06` build order step 4 (gradient boosting only if it beats the baseline); `05` Metrics | DELETE | S | hydro-ml-engineer | none | D2. Loading these at startup (`main.py:48-50`, `lstm_model.py:208-216`) runs `joblib.load` on files from a mounted volume, which allows arbitrary code execution. Removing them removes that risk |
| ML-004 | LSTM wrapper | `src/lstm_model.py`. 3 LSTM layers with BatchNorm and sequence length 24 (:23-87). This does not match the shipped `.h5`. Single-row inference repeats one row 24 times to fake a sequence (:158-162) | `06` step 4 and Explicit exclusions (no deep-learning nowcast) | DELETE | S | hydro-ml-engineer | none | Not on the plan path. Needs TensorFlow (about 500 MB image weight) |
| ML-005 | "Physics engine" | `main.py:181-214`, duplicated in the scenario path `main.py:334-367`; second fallback formula `main.py:397-398` | `06` step 2 (baseline learned from history) and step 3 | DELETE | S | hydro-ml-engineer | none | D3. Uncalibrated, and adds mm of rain directly as cm of water level. G5, G9 |
| ML-006 | GOD MODE | Global `DemoState` (`main.py:23-28`). Toggle `/admin/set-demo-mode` (:97-125) reads the secret from the JSON body field `_admin_secret` (:111), not a header as its docstring says. Unauthenticated `/admin/demo-status` (:127-132). Intercepts in `/predict` (:137-146, 1100 cm CRITICAL, fixed timestamp `2025-11-25T10:00:00Z`) and in `/verify-visual` (:265-273, 0.99). Scenario GOD MODE needs **no secret** (`main.py:307-316`, `scenarios.py:48-58`) | `10_GUARDRAILS.md` #5 (`NOAH_DEMO_MODE`, labeled, excluded from M1) | DELETE | S | hydro-ml-engineer | none | D4. Process-global state, so one toggle changes the output for every viewer. If UI tests need fixtures, put them in front-end test fixtures, not in the service |
| ML-007 | Scenarios | `src/scenarios.py:3-58`: 5 hardcoded input sets. `scenario_3` "Banjir Historis" claims to be 2020 data, but its values (150/85 mm, 950 cm) do not appear in `data/`. Endpoints `main.py:289-405`. Next proxies `app/api/scenarios/route.ts:7`, `app/api/scenarios/[id]/route.ts:11`. UI scenario mode `app/flood-predict/page.tsx:113-114,192-196` | `05` Acceptance (backtests run on real archives); `10` #5 | DELETE | S | hydro-ml-engineer, operator-ui-engineer | none | G5. Real "what if" analysis comes later as M1 backtests on archived events |
| ML-008 | Risk thresholds | `main.py:223-234` and `:372-383` use 400/700/850 cm. `metrics.py:65` uses `SIAGA_1` 150 and `SIAGA_2` 100. The two sets contradict each other and the official values | `04_DATA_SOURCES.md` Rules (Siaga thresholds as configuration; Manggarai >750/>850/>950 cm) | REFACTOR | S | data-ingestion-engineer | station config table | D12. M2 features use "TMA relative to Siaga" read from `stations.siaga_thresholds` |
| ML-009 | Regression metrics | `src/metrics.py:14-56` computes RMSE, MAE, MAPE, R2. `:58-81` computes risk accuracy | `05_MODULE_1_EVALUATION.md` Metrics; `10` #9 | DELETE | S | evaluation-engineer | ML-033 | G9. Replace with POD, FAR, CSI, bias, Brier, and lead time in the M1 service |
| ML-010 | Feature engineering | `src/preprocessing.py` stops mid-function: `_engineer_features` ends with a bare `df` at :150, so it returns `None`, and no lag or rolling features exist. The intended set is visible in `models/lstm_scaler_features.pkl` (60 names) and the `preprocessed_data.csv` header: cyclical hour, day, and month; rain lags 1-24 h; rolling sums 3-24 h; TMA lags 1-6 h; rain-category one-hots | `06` step 2 (rain past 1 h and 3 h, forecast rain 1-3 h, TMA vs Siaga), step 4 (add susceptibility and seasonality) | REBUILD | M | hydro-ml-engineer | ML-013, S1/S4 connectors | Keep the ideas: cumulative rain windows, upstream lags (Katulampa to Manggarai), cyclical seasonality. Rewrite as pure, tested functions over `observations`, with explicit units and UTC. TMA lags are leakage-prone; use relative-to-Siaga instead |
| ML-011 | Training and backtest pipeline | Not found. `training_results.json:225-286` cites `pipeline_version 1.0.0` (2025-11-22) and inputs `../../data/...`, but no training script is in the repository or its git history (only `__pycache__` files were ever deleted) | `06` step 2 and step 4; `09` W7-W8 | NEW | M | hydro-ml-engineer | ML-029, M1 service | Reproducible CLI: data snapshot ID, config, `model_version`, M1 metrics on a held-out period, and the baseline reported next to every model |
| ML-012 | Training report | `models/training_results.json` (7,966 B), `models/training_accuracy_plot.png` (68,593 B) | `05` Metrics; `10` #9 | DELETE | S | hydro-ml-engineer | none | D2 evidence is quoted below before deletion. It reports `accuracy` 0.936 next to recall 0, which is the misleading framing G9 forbids |
| ML-013 | Raw TMA archive | `data/tma_2020.xlsx.csv` (2,985,748 B, 31,059 rows). 21 posts from Cibalok to the coast, with lat/lon and Siaga status, 2019-12-23 03:50 to 2020-01-31 23:10. `tinggi_air` looks like mm (Manggarai 4870-9690, that is 487-969 cm). Timestamps have no timezone | `04` S2 (Open Data Jakarta TMA archive); `05` Acceptance (backtest on S2) | KEEP | S | data-ingestion-engineer | object storage, S2 connector | Only about 40 days, but it covers the 1 Jan 2020 event. Move it to object storage as a raw S2 payload. Verify units and datum with DSDA and assume WIB until confirmed (G8). Remove it from the Docker image and the Next.js bundle |
| ML-014 | Derived training CSV and dummies | `data/DATASET_FINAL_TRAINING.csv` (26,723 B, 744 hourly rows for Jan 2020): `hujan_bogor`, `hujan_jakarta`, `tma_manggarai`. TMA is in **decimetres** (55.15-96.75, matching the mm archive divided by 100), and the rain gauge source is unknown. `data/floodgauges_dummy.json` and `data/rainfall_dummy.json` are 0 bytes. The CSV is replayed as live by `app/api/water-level/route.ts:23,46-53,74-75` and `app/api/sensor-simulator/route.ts:23` | `04` S1/S2; `10` #5 #8 | DELETE | S | data-ingestion-engineer | D1 fix | D1 coupling: the "LIVE" level is decimetres labeled as `water_level_cm`, so a level of 65 dm (650 cm) is shown as 65 cm. G5, G8 |
| ML-015 | Bogor rain series | `data/hujan_bogor2022.csv` (386,070 B, 17,544 hourly rows, 2022-01-01 to 2024-01-01, `time,precipitation (mm)`). It looks like an Open-Meteo export, with timestamps that are probably GMT and have no timezone label | `04` S5 fallback (Open-Meteo only as a labeled fallback) | PARK | S | data-ingestion-engineer | none | This is not an observation source. Reanalysis or model rain is only acceptable as a labeled covariate in research backtests |
| ML-016 | `POST /verify-visual` and Roboflow client | `main.py:262-287`; `src/yolo_model.py`. Sends base64 images to `serverless.roboflow.com`, workspace and workflow hardcoded (:27-29, :59-70). **Committed Roboflow key used as fallback at `yolo_model.py:48`** (value not reproduced). Optional `ultralytics` import (:19-25). `model_path` is stored but never used (:37-40). On error it silently returns "not flooded" (:153-162) | `04` S12 (REQUESTED); `03` ISSP compatibility (prefer SCCIC VIANA) | DELETE | S | platform-security-engineer (key), hydro-ml-engineer | key rotation | D11, G10. Sending DSDA CCTV frames to a third-party SaaS conflicts with G4 (data use per agreement). Roboflow is a paid service nobody approved (G14). The silent "not flooded" fallback is dangerous |
| ML-017 | CCTV analytics (target) | Not found in usable form | `04` S12; `03` ISSP compatibility; `06` (CCTV is supplementary input or verification only) | NEW | M | hydro-ml-engineer | S12 granted; VIANA decision | Defer until S12 access exists (W4-W6 at the earliest). Prefer VIANA outputs ingested as `flood_reports(source=cctv)`. If a local detector is needed, use non-AGPL weights in-house (no frame egress) and report it against M1 |
| ML-018 | YOLO weights | `models/yolov8n.pt` and `models/yolo_model.pt`: 6,549,796 B each, PyTorch zip, **byte-identical** (md5 `95a24496...`). Generic COCO YOLOv8n with no flood class, unused at runtime | `10` #13 | DELETE | S | hydro-ml-engineer | none | Ultralytics weights and code are AGPL-3.0, so they cannot go into the core (G13). They also add 13 MB to the repo and image |
| ML-019 | `/api/cctv-scan` (Next.js) | `app/api/cctv-scan/route.ts:13-28` fetches any `source_url` from the request body on the server, with no auth, then forwards it to `/verify-visual` (:46) | `04` S12 connector rules; `08_ROLES_AND_ACCESS.md` | DELETE | S | platform-security-engineer | none | SSRF vector. The S12 connector will use a fixed allow-list of DSDA camera endpoints |
| ML-020 | CCTV "simulation" page | `lib/constants.ts:912-960` hardcodes `is_flooded`, `flood_probability`, and "last scan N min ago" for 4 posts, shown with local mp4 files; `app/cctv-simulation/page.tsx` | `10` #5 | DELETE | S | operator-ui-engineer | none | G5: fake detections shown as recent scans. If it must survive for demos, put it behind `NOAH_DEMO_MODE` with a "DEMO" label |
| ML-021 | `/api/predict` proxy | `app/api/predict/route.ts`. Auto mode calls the D1 replay (`:25`) and OpenWeatherMap current rain (`app/api/rainfall-dual/route.ts:28-48`, `rain['1h']`). Defaults water level to **300 cm** when missing (`:33`). Callers rely on `res.ok`, which is true even for ML errors: `hooks/usePredictionData.ts:36-48`, `components/flood-map/PredictionLayer.tsx:46-54`, `app/flood-report/page.tsx:152`, `app/flood-predict/page.tsx:105-129` | `03` `GET /api/v1/nowcast/current`; `10` #5 #7 | REBUILD | M | backend-engineer, operator-ui-engineer | ML-029, ML-033 | G5 (fabricated default), G7, G8. Failure fallback today is "show whatever came back". The target is stale/greyed state driven by `issued_at` |
| ML-022 | Map prediction layer | `components/flood-map/PredictionLayer.tsx:22-24,74-93` copies the single Manggarai prediction to other points "for visual spread" | `03` Operator UI; `06` Impact (per-polder and per-kelurahan) | REFACTOR | S | operator-ui-engineer | ML-029 | Keep the Leaflet layer shell and render per-polder probabilities from the API. Delete the spreading logic (G5, G7) |
| ML-023 | Smart alert chain | `app/api/smart-alert/route.ts:31-60` combines the prediction and CCTV into a "confidence" (:62-95). At WASPADA or above it fires `/api/sms-alert` (:121-130) with "EVAKUASI SEGERA ... posko evakuasi" (:99) | `10` #1; `06` Recommendations (operators only) | DELETE | S | platform-security-engineer | Twilio decision | **G1 violation**: model output drives citizen SMS. The operator-facing replacement is the `06` trigger-to-action table |
| ML-024 | `/api/ml-health` | `app/api/ml-health/route.ts:4-27` proxies `/health` and returns 503 with `lstm_ready:false` on failure | `03` `/api/v1/health` | REFACTOR | S | backend-engineer | ML-001 | The fallback pattern (503 plus an explicit unavailable state) is the right one. Change the payload to connector and model freshness |
| ML-025 | `predictions` and `detections` tables | `supabase/migrations/20250309000000_create_predictions_detections.sql:2-44`. No code writes to them (grep found no `.from('predictions')`). Public SELECT policy (:39-40), INSERT open to all (:43-44), not append-only | `03` data model `forecasts`; `10` #6 | DELETE | S | backend-engineer | target schema | Replace with immutable `forecasts` and `verifications`. Public read conflicts with G1 and G4 |
| ML-026 | Dockerfile and compose | `ml-service/Dockerfile:1-40`: multi-stage `python:3.10-slim`, installs `libgl1` for OpenCV, `COPY . .` bakes data and models into the image (:33), runs as root, no HEALTHCHECK. `docker-compose.yml:17-29` mounts models and data read-only and passes `ROBOFLOW_API_KEY` (:25). There is no `ml-service/.dockerignore` | `03` budget (1 VPS, containers, staging stack); `10` #12 #14 | REFACTOR | S | platform-security-engineer | ML-027 | Keep the multi-stage pattern. Drop TF, OpenCV, and libgl. Add a non-root user, HEALTHCHECK, a lockfile install, and a `.dockerignore`. Use a separate worker image for the geo stack (GDAL/rasterio) so the API image stays small |
| ML-027 | Python dependencies | `ml-service/requirements.txt:1-10` uses only `>=` lower bounds (fastapi, uvicorn, python-multipart, numpy, opencv-python-headless, tensorflow-cpu, scikit-learn, pydantic, requests, joblib). `ultralytics` is imported but not listed. The pickles were written with sklearn 1.7.2 and the cpython-313 `.pyc` files show Python 3.13 was used locally, while the image uses 3.10 | `10` #13 (record licenses); `09` Definition of done | REBUILD | S | hydro-ml-engineer | none | Pin with a lockfile and generate a license report in CI (for example `pip-licenses`). See the license table below |
| ML-028 | Geo pipeline (D8) | Not found. No DEM, subsidence, depression, or HAND code; no rasterio/GDAL dependency; no raster storage | `06` build order step 1; `03` Components "Geo pipeline"; `04` S9, S11 | NEW | L | hydro-ml-engineer | S9 download, S11 rates, polder boundaries (S8 or manual) | `DEM_t = DEM_survey - rate_zone*(t - t_survey)`, then fill, then HAND. Store versioned rasters and per-unit features. Use WhiteboxTools (MIT) rather than pysheds (GPL-3.0, see licenses). No RW-level claims at 20 m |
| ML-029 | M2 baseline rule | Not found | `06` step 2; `05` Sources logged ("Baseline") | NEW | M | hydro-ml-engineer | M1 event def v1, S1 and S4 history, ML-010, ML-028 | Logistic or empirical-frequency model on rain 1 h/3 h, forecast rain, and TMA relative to Siaga. Logged as `source=baseline` forever. Ships W3 |
| ML-030 | Pump-aware adjustment | Not found | `06` step 3 | NEW | S | hydro-ml-engineer | ML-031 | A documented rule that raises probability when the sump is full within the lead time or pumps are off or anomalous |
| ML-031 | M3 water balance and pump anomaly (D8) | Not found. Pump data is only `generateMockPumpStatus` (`app/dashboard/page.tsx:31`, D5) and a client `fetchPumpStatusData` (`lib/api.client.ts:132-142`) that calls `/api/pump-status`, a route that does not exist. No pump or polder tables in `supabase/migrations/` | `07_MODULE_3_POLDER_OPS.md` (all sections); `04` S6, S7 | NEW | M | hydro-ml-engineer | `polder_params`, `pumps`, `pump_states` schema; S7 inventory | Simulator mode labeled "SIMULASI" and excluded from M1 (G5). No SCADA writes (G2). Table tests for the balance (G11) |
| ML-032 | Rain nowcast upgrade (pySTEPS) | Not found | `06` step 5; `04` S5 | NEW | M | hydro-ml-engineer | BMKG gridded data or radar | pySTEPS is BSD-3. Until then use BMKG products as provided, and Open-Meteo only as a labeled fallback |
| ML-033 | Forecast output contract and writer | Not found. No ML output carries `model_version`, `issued_at`, or input timestamps (`main.py:236-241`), and nothing is persisted | `03` data model `forecasts`, MQTT `noah/v1/{polder_code}/nowcast`; `06` Acceptance | NEW | S | hydro-ml-engineer, backend-engineer | target schema | Append-only insert of `source`, `model_version`, `issued_at`, `lead_min`, `valid_from/to`, `probability`, and input timestamps in `payload` (G6, G7). MQTT behind a flag, off by default |
| ML-034 | Python tests in CI | Not found. No `tests/` in `ml-service`; `.github/workflows/ci.yml:26-32` covers only Node | `10` #11; `09` Definition of done | NEW | S | qa-verifier, hydro-ml-engineer | ML-027 | pytest job: feature functions, baseline fit on fixtures, water-balance table tests, schema of `forecasts` rows |
| ML-035 | ML challenger (gradient boosting) | Not found (the only model is the LSTM, ML-003) | `06` step 4; `09` W7-W8 | NEW | M | hydro-ml-engineer | ML-029, ML-011, about one season of logged data | LightGBM (MIT) or XGBoost (Apache-2.0). Replaces the baseline in recommendations only if CSI at 60 min and longer leads is higher and FAR is not worse. CPU is enough, so the GPU budget is untouched |

## D2, D3, D4, D8 confirmation

### D2: LSTM trained on 62 features, served with 3. CONFIRMED, with corrections
- **Serving.** `main.py:170-171` builds `features = np.array([[rain_jkt, rain_jkt, water_cm]])`; the in-code comment at `:170` already warns that the model may expect 62 features. The scenario path does the same at `main.py:330`. Jakarta rain is passed twice and Bogor rain is dropped, even though `rain_bogor` is parsed at `:156`.
- **Shipped metrics.** `models/training_results.json:4-8` gives input shape `[720, 62]`, and `:19` gives `"r2": -0.41239222079602533`. `:29-37` gives `"recall": 0.0`, `"true_flood_events": "9"`, `"pred_flood_events": "0"`, `"missed_floods": "9"`, alongside `"accuracy": 0.9357` at `:32`. The data split is 417/139/140 rows (`:212-215`), all from one month (Jan 2020).
- **Correction 1: the shipped `.h5` is not that 62-feature model.** The HDF5 config in `models/lstm_flood_forecaster.h5` declares `batch_shape [null, 12, 3]` with 2 LSTM layers (64 and 32 units) plus Dense layers and no BatchNorm. This matches neither `training_results.json` (sequence length 24, 62 inputs) nor `lstm_model.py:51-87` (3 LSTM layers with BatchNorm). Where the artifact came from is unknown.
- **Correction 2: the 3-feature mismatch is worse than it looks.** `lstm_scaler_X.pkl` has `n_features_in_ = 3`, and its `scale_` values imply feature ranges of 17.7, 24.8 and 41.6. Those match exactly the ranges of `hujan_bogor` (max 17.7), `hujan_jakarta` (max 24.8) and `tma_manggarai` (55.15 to 96.75, which is **decimetres**) in `data/DATASET_FINAL_TRAINING.csv`. So the model expects `[bogor_mm, jakarta_mm, tma_dm]` but is given `[jakarta_mm, jakarta_mm, tma_cm]`. The level arrives 10 times larger than anything it was trained on: 650 cm scales to about 14, against a training range of [0, 1].
- **Correction 3: sequence length.** `lstm_model.py:158-162` repeats the single row 24 times, but the model was built for 12 timesteps. Whether this throws depends on the Keras version (tf.keras 2.x usually warns and runs; Keras 3 may raise). I did not run it, per the audit rules. It does not matter much: if it runs, the output is meaningless, and because its deviation from the current level exceeds 200 cm, it gets weight 0.05 (`main.py:183-185`). If it throws, `pred_lstm_raw = water_cm` (`:164`) and the result is pure D3. Either way, users see the D3 formula labeled as AI ("REAL AI LOADED", `main.py:52`).
- **Training code missing.** No script that produced either artifact exists in the repository or its history, and `preprocessing.py:150` is truncated.
- **Decision:** DELETE the model and artifacts (ML-002 to ML-004, ML-012). REBUILD forecasting per `06` (ML-029 onward).

### D3: "physics engine". CONFIRMED
In `main.py:181-214` (duplicated at `:334-367`):
- Blend (`:183-191`): `weighted = water_cm*w_p + lstm*w_ai`, with `(w_p, w_ai)` set to (0.95, 0.05), (0.85, 0.15) or (0.70, 0.30) depending on how far the LSTM output deviates.
- Rain term (`:195-198`): `rain_bias = min(0.8*rain_bogor + 0.5*rain_jkt, 200)`. Rain in mm (OpenWeatherMap's instantaneous `rain['1h']` in auto mode) is added directly as cm of water level, with no catchment, no lag, and no calibration.
- Rule A (`:205-206`): the level never drops if total rain exceeds 20 mm.
- Rule B (`:209-214`): the change is capped at +150 cm or -75 cm.
- Thresholds 400/700/850 (`:223-234`, D12).
- A third formula, `water + 0.5*rain_jkt`, sits at `:254` (unreachable) and `:398` (scenario fallback).
- **Decision:** DELETE (ML-005).

### D4: "GOD MODE". CONFIRMED, with an extra unauthenticated path
- Global state at `main.py:23-28`. Toggle at `:97-125`, gated on `ADMIN_SECRET` (`:106-113`), which is compared against a body field rather than a header. Unauthenticated status endpoint at `:127-132`.
- The `/predict` intercept (`:137-146`) returns `prediction_cm 1100.0`, `CRITICAL`, "SIAGA 1 - EVAKUASI SEGERA!" with the hardcoded timestamp `2025-11-25T10:00:00Z`. The `/verify-visual` intercept (`:265-273`) returns `flood_probability 0.99`.
- **Additional path:** `scenario_demo` (`scenarios.py:48-58`, `god_mode_enabled: True`) returns the same canned CRITICAL result through `POST /predict/scenario/scenario_demo` (`main.py:307-316`) with **no secret at all**. It is exposed through `app/api/scenarios/[id]/route.ts:11` and selectable in the public `app/flood-predict/page.tsx` scenario mode.
- **Decision:** DELETE from the service (ML-006, ML-007). Do not PARK it in the API. If the UI needs canned states for tests, use front-end fixtures behind `NOAH_DEMO_MODE` with a visible label.

### D8: elevation, HAND, polder, water balance, pump. CONFIRMED absent
- Searched all `*.py`, `*.ts`, `*.tsx`, `*.sql`, and `*.mjs` outside the excluded directories for DEM, elevation, HAND, polder, sump, pump, water balance, subsidence, rasterio, pysheds, whitebox, SWMM, and LiDAR.
- Hits are only UI tables of pump *building condition* (`components/dashboard/InfrastructureStatusCard.tsx:159-393`, `components/panels/DataPanel.tsx:111-141`). These are fed by mock data (`app/dashboard/page.tsx:31`) or by a client for a non-existent route (`lib/api.client.ts:136`).
- No geo dependencies, no raster data, and no polder or pump tables in `supabase/migrations/`.
- **Decision:** NEW (ML-028 to ML-031).

## CV/YOLO: is it in scope?
- **Scope:** only as supplementary input. `04` S12 (118 DSDA cameras) is **REQUESTED** and listed as "none; CCTV is supplementary". `03` says to prefer SCCIC VIANA if access is granted, otherwise a thin local detector.
- **What exists:** none of it is a foundation:
  - a Roboflow cloud call that sends frames off-site;
  - a committed key at `yolo_model.py:48`;
  - unused generic COCO weights (no flood class);
  - an AGPL import;
  - a silent "not flooded" fallback;
  - an SSRF-prone scan route;
  - a page of hardcoded detections.
- **Recommendation:**
  - DELETE all of it (ML-016, ML-018, ML-019, ML-020). Rotate the key in W1 (platform-security-engineer).
  - Re-open as ML-017 only once S12 is granted.
  - Ingest VIANA results as `flood_reports(source=cctv)` and verify them through M1 like any other source.

## Reuse map
| Existing | Carries over to | Condition |
|---|---|---|
| FastAPI app and OpenAPI (`ml-service/src/main.py:1-21,82-95`) | `03` API v1 (read endpoints, health) | Strip models, demo, and scenarios; move M2 and M3 into scheduled workers |
| `ml-service/Dockerfile` multi-stage pattern, `docker-compose.yml:17-29` service wiring | API container and a separate geo/M2 worker image | Non-root, healthcheck, lockfile, no baked data, no TF or OpenCV |
| `app/api/ml-health/route.ts` 503-on-failure pattern | Next.js proxy for `/api/v1/health` | Change the payload to connector freshness |
| `components/flood-map/PredictionLayer.tsx` shell | Ringkasan map layer for per-polder nowcast | Remove the spread logic |
| Feature ideas from `preprocessing.py` and `lstm_scaler_features.pkl` (cumulative rain windows, upstream lags, cyclical seasonality) | M2 baseline features (`06` step 2) | Re-implement with tests, UTC timestamps, and Siaga-relative TMA |
| `data/tma_2020.xlsx.csv` | S2 raw archive for the M1 backtest | Units, datum, and timezone verified with DSDA |
| Nothing from LSTM, physics, GOD MODE, scenarios, metrics, or CV | none | none |

## Dependency licenses (guardrail 13)
The licenses below come from the packages' published licenses. I could not run `pip-licenses`, so add it to CI to verify (ML-027).

| Package | Where | License | Concern |
|---|---|---|---|
| fastapi, pydantic | `requirements.txt` | MIT | none |
| uvicorn | `requirements.txt` | BSD-3 | none |
| python-multipart, requests | `requirements.txt` | Apache-2.0 | none |
| numpy, scikit-learn, joblib | `requirements.txt` | BSD-3 | none |
| tensorflow-cpu | `requirements.txt` | Apache-2.0 | To be removed (ML-004); large image |
| opencv-python-headless | `requirements.txt` | Apache-2.0 (OpenCV 4.5 and later); wheels bundle FFmpeg (LGPL-2.1) | Acceptable if dynamically linked; to be removed with CV |
| **ultralytics** | `yolo_model.py:19-25` (not in requirements) | **AGPL-3.0** | **G13 violation risk.** Must not be linked into the core |
| **yolov8n.pt / yolo_model.pt** | `models/` | **AGPL-3.0** (Ultralytics weights) | **G13**; delete (ML-018) |
| Roboflow serverless API | `yolo_model.py:27,61-67` | Proprietary SaaS terms | G4 (data egress), G14 (paid service not approved) |
| *Planned:* rasterio, geopandas, pySTEPS, xskillscore | `03`, `06` | BSD-3 (rasterio, geopandas, pySTEPS), Apache-2.0 (xskillscore) | none |
| *Planned:* WhiteboxTools | `03` Geo pipeline | MIT | Preferred for depressions and HAND |
| *Planned:* **pysheds** | `03` Geo pipeline ("WhiteboxTools or pysheds") | **GPL-3.0** | **The plan names a GPL option for the core.** Use WhiteboxTools, or run pysheds only in a separate research service |
| *Planned:* LightGBM / XGBoost | `06` step 4 | MIT / Apache-2.0 | none |
| *Planned:* pyswmm (EPA SWMM) | `07` Optional | pyswmm BSD-2 (verify); SWMM public domain | Verify before adoption |

## Guardrail violations found (for W1 backlog)
- **#1 No public warnings:**
  - `app/api/smart-alert/route.ts:121-130` sends model-driven SMS to subscribers.
  - Evacuation instructions appear in model responses (`main.py:144,225,314,374`) and in `smart-alert/route.ts:99`, and are shown on public pages.
- **#4 Data use per agreement:** CCTV frames go to Roboflow (`yolo_model.py:61-67`). `predictions` and `detections` have a public-read RLS policy (migration `:39-40`).
- **#5 No fake data:**
  - GOD MODE (`main.py:23-146,265-273,307-316`) and scenarios (`scenarios.py`).
  - Replay of decimetre CSV values labeled as cm (`app/api/water-level/route.ts:74-75`).
  - Default 300 cm (`app/api/predict/route.ts:33`).
  - Copied predictions (`PredictionLayer.tsx:74-93`).
  - Hardcoded CCTV detections (`lib/constants.ts:912-960`).
- **#6 Append-only facts:** forecasts are never stored. The existing table is not immutable (migration `:2-44`).
- **#7 Provenance:** no `model_version` or `issued_at` on outputs (`main.py:236-241`); fixed fake timestamps (`main.py:145,272,315`).
- **#8 Units and time:** decimetres treated as cm (ML-014, D2); timestamps without timezone in every data file and in `preprocessing.py:111`.
- **#9 Honest metrics:** R2, MAPE, and accuracy reported (`training_results.json:15-38`, `metrics.py:14-81`).
- **#10 Secrets:** Roboflow key committed at `yolo_model.py:48` (D11; rotate, then purge from history).
- **#11 Tests in CI:** no Python tests; CI ignores `ml-service`.
- **#12 Observability:** ML errors are returned as HTTP 200 (`main.py:159-161,243-251`); CV errors are swallowed and returned as "not flooded" (`yolo_model.py:153-162`).
- **#13 Licensing:** ultralytics and its weights are AGPL-3.0; the plan itself offers pysheds (GPL-3.0) for the core geo pipeline.
- **#14 Budget:** Roboflow paid SaaS without approval.
- **#2 No SCADA control:** no violation found. No code writes to SCADA, pumps, or gates.

## Open questions
| # | Question | Who can answer |
|---|---|---|
| 1 | Where did `lstm_flood_forecaster.h5` (12x3 input) come from, and where is the training script behind `training_results.json` (62 features)? Can both be deleted outright? | Ari |
| 2 | Which gauges and units are `hujan_bogor` and `hujan_jakarta` in `DATASET_FINAL_TRAINING.csv` (mm per hour, which station)? What timezone are all the CSVs in? | Ari |
| 3 | Has the Roboflow key (`yolo_model.py:48`) been rotated? Did any DSDA or third-party CCTV frames ever go to the `ari-aziz` Roboflow workspace? | Ari, platform-security-engineer |
| 4 | Is `tinggi_air` in the Open Data TMA archive in mm, and relative to which datum per post? Can DSDA supply the official Siaga table for all posts? | DSDA |
| 5 | Can the BPBD RT flood-report archive (S4) for 2020 to 2026 be shared? The M2 baseline cannot be fitted or evaluated without event labels. | BPBD DKI |
| 6 | Which lighthouse polders, and can polder boundaries (S8) and per-house pump capacities (S7) be provided before W2? Otherwise catchments are derived from the DEM and boundaries digitized by hand. | DSDA |
| 7 | Is SCCIC VIANA available for DSDA cameras, and what is its output schema? This decides whether ML-017 is a connector or a detector. | SCCIC ITB |
| 8 | Is BMKG gridded nowcast data obtainable under a research agreement (this triggers pySTEPS, ML-032)? | BMKG |
| 9 | Should the plan's `03` "WhiteboxTools or pysheds" be amended to WhiteboxTools only, because pysheds is GPL-3.0 (guardrail 13)? | Ari (plan owner) |
| 10 | Does the target keep FastAPI as the single v1 API with M2 and M3 as separate scheduled workers (my recommendation), or is the Next.js app expected to host the read API? | Ari, backend-engineer |
