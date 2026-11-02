# 03. Target architecture

## Principle: Sensing, Understanding, Acting, Feedback
This is the loop SCCIC ITB uses for all its smart-system platforms; Noah follows it so it can slot into that ecosystem.

```
SENSING                     UNDERSTANDING                   ACTING                     FEEDBACK
connectors (every 5-10 min) M2 impact nowcast per polder    recommendations to         M1 matches every stored
  Posko Banjir DSDA (TMA)   M3 polder water balance         operators (dashboard,      forecast with BPBD RT
  BMKG nowcast              rules: trigger -> action        WhatsApp group)            reports, computes POD,
  BPBD RT flood reports                                     operators decide            FAR, CSI, lead time;
  SCADA (when granted)                                      no public output            weekly report
  CCTV snapshots (when granted)
         |                          |                              |                          |
         +--------> append-only store (PostgreSQL + PostGIS, object storage) <----------------+
```

## Components
| Component | Responsibility | Technology (default, change only with reason) |
|---|---|---|
| Connectors | Pull or receive data from each source on a schedule; normalize units and time; write raw and normalized records; never overwrite | Python workers (APScheduler or cron), one module per source |
| Store | Append-only observations, forecasts, verifications; spatial units | PostgreSQL 15+ with PostGIS (managed); raw payloads and rasters in S3-compatible object storage |
| Geo pipeline | DEM ingest, subsidence correction, depressions and HAND, polder and kelurahan geometry | Python: rasterio, WhiteboxTools or pysheds, geopandas |
| M1 Evaluation service | Event definitions, matching, metrics, reports | Python, xskillscore or plain numpy/pandas |
| M2 Impact nowcast service | Per-polder flood probability for 60, 120, 180 min; impact; recommendations | Python; baseline rules first, gradient boosting second, pySTEPS when radar data exists |
| M3 Polder ops service | Water balance, time to full, drawdown advice, pump anomaly | Python; EPA SWMM optional via pyswmm |
| API | Read endpoints for UI and partners; webhooks; auth | FastAPI (existing ML service can become this) with OpenAPI spec |
| Operator UI | Dashboard for Posko, pump house, Pusdalops, supervisors | Existing Next.js app, rebuilt pages |
| Notifier | Operator WhatsApp group messages and weekly email report | WhatsApp gateway; no public channels |
| Ops | Monitoring, alerts when a pipeline stalls more than 15 minutes, backups | Sentry, uptime monitor, daily DB backup |

Infrastructure must fit the budget: one production VPS (4 vCPU, 8 GB) running all services as containers including a staging stack, one managed PostgreSQL/PostGIS, about 2 TB object storage, about 60 GPU hours total.

## Data model (minimum)
All times in UTC. All tables that represent facts in time are append-only; corrections are new rows with `supersedes_id`.

```
spatial_units(id, kind[polder|kelurahan|rt|rw], code, name, geom, parent_id, meta jsonb)
stations(id, source, external_id, name, kind[tma|arr|pump|gate|cctv], geom,
         datum_note, unit, siaga_thresholds jsonb, polder_id, active)
observations(id, station_id, ts, value, unit, quality_flag, ingested_at, raw_ref)        -- append-only
pumps(id, polder_id, station_id, capacity_m3s, kind[stationary|mobile], scada_tag)
pump_states(id, pump_id, ts, is_on, flow_m3s, current_a, source, ingested_at)           -- append-only
polder_params(polder_id, sump_capacity_m3, catchment_area_m2, runoff_coeff,
              level_to_volume jsonb, valid_from, source)
rain_products(id, source, issued_at, valid_at, kind[nowcast|obs|nwp], uri, meta)         -- rasters in object storage
flood_reports(id, source[bpbd_rt|pasukan_biru|jaki|petabencana|cctv], unit_id, ts_start, ts_end,
              depth_cm, raw_ref, ingested_at)                                            -- append-only
forecasts(id, source[noah_m2|noah_m3|bmkg|dsda_siaga|jawara|floodhub|baseline],
          model_version, issued_at, unit_id, lead_min, valid_from, valid_to,
          probability, category, threshold_def, payload jsonb)                           -- append-only, immutable
event_definitions(version, description, rule jsonb, agreed_with, valid_from)
verifications(id, forecast_id, event_def_version, outcome[hit|miss|false_alarm|correct_negative],
              observed_ts, lead_time_min, computed_at)                                   -- append-only
recommendations(id, forecast_id, unit_id, action_type[mobile_pump|crew|drawdown|gate_watch|inspect_pump],
                text_id, payload jsonb, sent_at, channel, ack_by, ack_at, operator_action, note)
users(id, name, org, role, phone_hash, created_at)        -- roles in 08_ROLES_AND_ACCESS.md
audit_log(id, user_id, action, object, ts)
```

## API (v1, documented with OpenAPI)
- `GET /api/v1/units?kind=polder` and `/api/v1/units/{id}`
- `GET /api/v1/observations?station_id=&from=&to=`
- `GET /api/v1/forecasts?unit_id=&source=&from=&to=`
- `GET /api/v1/nowcast/current` (latest M2 output per polder)
- `GET /api/v1/polders/{id}/status` (M3: level, volume, time to full, pumps, anomalies)
- `GET /api/v1/recommendations?status=open` and `POST /api/v1/recommendations/{id}/ack`
- `GET /api/v1/scoreboard?from=&to=&source=&lead=` (M1)
- `GET /api/v1/reports/weekly/{iso_week}` (PDF or HTML)
- `GET /api/v1/health` (per-connector freshness)

## Operator workflow (what the UI must support)
1. 13:00 BMKG nowcast shows heavy rain over North Jakarta from 15:00.
2. 13:05 M2 computes polder probabilities; Sunter Selatan 70% at 15:30 to 17:00.
3. 13:10 recommendation goes to the WhatsApp group and dashboard: probability, time window, sump fill state, suggested drawdown time, suggested mobile pump destinations, people exposed.
4. The operator acknowledges and records the action taken (followed, deferred, ignored, with optional note).
5. Evening: BPBD reports arrive; M1 matches them; the scoreboard updates.
6. Monday: weekly report to DSDA supervisors.

## ISSP compatibility (SCCIC ITB)
Build so Noah can be mounted on SCCIC's ISSP later without rewriting:
- Every API documented with OpenAPI 3; JSON payloads with explicit units and UTC timestamps.
- Auth through OIDC so it can switch to ISSP's Keycloak SSO; start with a local OIDC provider or Supabase Auth behind an adapter.
- Publish M2 and M3 outputs also to MQTT topics `noah/v1/{polder_code}/nowcast` and `noah/v1/{polder_code}/status` (feature flag; off by default).
- Keep connectors isolated so ISSP's data hub can replace them.
- CCTV analytics: prefer SCCIC VIANA if access is granted; otherwise a thin local detector (see `04_DATA_SOURCES.md`).
