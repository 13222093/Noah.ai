-- 0003  Fact tables (B-031, plan 03 "Data model"). All append-only.
--
-- Conventions (guardrails 6, 7, 8):
-- - timestamptz everywhere; the application writes UTC.
-- - Units normalized at ingestion: water level cm (relative to the station
--   datum), rainfall mm, discharge m3/s. `unit` is explicit on every row.
-- - ingested_at is set by the database, raw_ref points at the verbatim
--   payload in object storage (raw_payloads.key).
-- - A correction is a new row with supersedes_id; nothing is updated.
-- - Idempotency: each table has a natural unique key (a partial unique
--   index or UNIQUE NULLS NOT DISTINCT, PostgreSQL 15+) and the store inserts
--   with ON CONFLICT DO NOTHING (no conflict target, so every unique index
--   counts), so a re-poll, restart or re-import is a no-op. Never ON CONFLICT
--   DO UPDATE.

-- Index of every raw payload stored in object storage (B-033).
CREATE TABLE raw_payloads (
  key           text PRIMARY KEY,      -- raw/{source}/{YYYY}/{MM}/{DD}/{fetched_at}_{sha12}.{ext}
  source        text NOT NULL,
  fetched_at    timestamptz NOT NULL,
  sha256        text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes    bigint NOT NULL CHECK (size_bytes >= 0),
  content_type  text NOT NULL,
  url           text,                  -- without credentials or tokens
  ingested_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX raw_payloads_source_fetched_idx ON raw_payloads (source, fetched_at DESC);
CREATE INDEX raw_payloads_sha_idx ON raw_payloads (sha256);

CREATE TABLE observations (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  station_id     bigint NOT NULL REFERENCES stations (id),
  ts             timestamptz NOT NULL,        -- measurement time reported by the source
  value          double precision NOT NULL,
  unit           text NOT NULL CHECK (unit IN ('cm', 'mm', 'm3/s')),
  quality_flag   text NOT NULL DEFAULT 'ok'
                 CHECK (quality_flag IN ('ok', 'suspect', 'missing_unit', 'stale', 'manual')),
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  raw_ref        text REFERENCES raw_payloads (key),
  supersedes_id  bigint REFERENCES observations (id)
);
-- One original reading per post and source timestamp, whichever poll
-- delivered it first (its raw_ref wins). Re-polls, restarts and repeated
-- STALE readings are no-ops. A changed value for the same timestamp must be
-- written as a correction (supersedes_id), and each row is superseded at
-- most once, so corrections form a chain.
CREATE UNIQUE INDEX observations_station_ts_key ON observations (station_id, ts)
  WHERE supersedes_id IS NULL;
CREATE UNIQUE INDEX observations_supersedes_key ON observations (supersedes_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX observations_station_ts_idx ON observations (station_id, ts DESC);
CREATE INDEX observations_ingested_idx ON observations (ingested_at);

CREATE TABLE pump_states (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pump_id        bigint NOT NULL REFERENCES pumps (id),
  ts             timestamptz NOT NULL,
  is_on          boolean,
  flow_m3s       double precision,
  current_a      double precision,
  source         text NOT NULL,               -- scada | manual | simulator (SIMULASI, excluded from M1)
  quality_flag   text NOT NULL DEFAULT 'ok'
                 CHECK (quality_flag IN ('ok', 'suspect', 'missing_unit', 'stale', 'manual')),
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  raw_ref        text REFERENCES raw_payloads (key),
  supersedes_id  bigint REFERENCES pump_states (id)
);
-- Same pattern as observations: one original state per pump, source and time.
CREATE UNIQUE INDEX pump_states_pump_ts_key ON pump_states (pump_id, source, ts)
  WHERE supersedes_id IS NULL;
CREATE UNIQUE INDEX pump_states_supersedes_key ON pump_states (supersedes_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX pump_states_pump_ts_idx ON pump_states (pump_id, ts DESC);

-- Rasters and images live in object storage; `uri` is the object key.
CREATE TABLE rain_products (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL,
  issued_at      timestamptz NOT NULL,
  valid_at       timestamptz NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('nowcast', 'obs', 'nwp')),
  uri            text NOT NULL,
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  supersedes_id  bigint REFERENCES rain_products (id),
  CONSTRAINT rain_products_natural_key UNIQUE NULLS NOT DISTINCT
    (source, kind, issued_at, valid_at, uri, supersedes_id)
);
CREATE INDEX rain_products_valid_idx ON rain_products (source, kind, valid_at DESC);

-- RT-level flood reports (guardrail 3: no individual citizen data).
-- unit_code is the source's area code; unit_id is resolved when possible.
CREATE TABLE flood_reports (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL
                 CHECK (source IN ('bpbd_rt', 'pasukan_biru', 'jaki', 'petabencana', 'cctv')),
  external_id    text NOT NULL,
  unit_id        bigint REFERENCES spatial_units (id),
  unit_code      text,
  ts_start       timestamptz NOT NULL,
  ts_end         timestamptz,
  depth_cm       double precision,
  geom           geometry(Point, 4326),
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  raw_ref        text REFERENCES raw_payloads (key),
  supersedes_id  bigint REFERENCES flood_reports (id)
);
-- One original report per (source, external_id, ts_start): a re-scrape is a
-- no-op. A report whose end time or depth changed is written as a
-- correction with supersedes_id (each row superseded at most once).
CREATE UNIQUE INDEX flood_reports_source_ext_start_key ON flood_reports (source, external_id, ts_start)
  WHERE supersedes_id IS NULL;
CREATE UNIQUE INDEX flood_reports_supersedes_key ON flood_reports (supersedes_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX flood_reports_unit_ts_idx ON flood_reports (unit_id, ts_start DESC);
CREATE INDEX flood_reports_source_ts_idx ON flood_reports (source, ts_start DESC);
CREATE INDEX flood_reports_geom_idx ON flood_reports USING gist (geom);

-- Runs that produce forecasts. run_id NULL on a forecast = live; a non-live
-- run (backtest, replay) is excluded from live scores (plan issue P7, G-066).
CREATE TABLE forecast_runs (
  run_id       text PRIMARY KEY,
  kind         text NOT NULL CHECK (kind IN ('live', 'backtest', 'replay')),
  description  text,
  started_at   timestamptz NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE forecasts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL CHECK (source IN
                   ('noah_m2', 'noah_m3', 'bmkg', 'dsda_siaga', 'jawara', 'floodhub', 'baseline')),
  model_version  text NOT NULL,
  run_id         text REFERENCES forecast_runs (run_id),
  issued_at      timestamptz NOT NULL,
  unit_id        bigint REFERENCES spatial_units (id),
  lead_min       integer,
  valid_from     timestamptz NOT NULL,
  valid_to       timestamptz NOT NULL,
  probability    double precision CHECK (probability IS NULL OR probability BETWEEN 0 AND 1),
  category       text,
  threshold_def  text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- includes input timestamps
  ingested_at    timestamptz NOT NULL DEFAULT now(),
  supersedes_id  bigint REFERENCES forecasts (id),
  CONSTRAINT forecasts_window_chk CHECK (valid_to >= valid_from),
  CONSTRAINT forecasts_natural_key UNIQUE NULLS NOT DISTINCT
    (source, model_version, unit_id, issued_at, lead_min, run_id)
);
CREATE INDEX forecasts_unit_issued_idx ON forecasts (unit_id, issued_at DESC);
CREATE INDEX forecasts_source_issued_idx ON forecasts (source, issued_at DESC);

CREATE TABLE verifications (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  forecast_id        bigint NOT NULL REFERENCES forecasts (id),
  event_def_version  text NOT NULL REFERENCES event_definitions (version),
  outcome            text NOT NULL CHECK (outcome IN ('hit', 'miss', 'false_alarm', 'correct_negative')),
  observed_ts        timestamptz,
  lead_time_min      integer,
  computed_at        timestamptz NOT NULL DEFAULT now(),  -- the latest computed_at wins
  meta               jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_id      bigint REFERENCES verifications (id),
  CONSTRAINT verifications_natural_key UNIQUE (forecast_id, event_def_version, computed_at)
);
CREATE INDEX verifications_forecast_idx ON verifications (forecast_id, computed_at DESC);

-- One row per scheduled connector run; feeds /api/v1/health freshness.
CREATE TABLE connector_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connector     text NOT NULL,
  started_at    timestamptz NOT NULL,
  finished_at   timestamptz NOT NULL,
  status        text NOT NULL CHECK (status IN ('ok', 'partial', 'failed')),
  rows_written  integer NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
  newest_ts     timestamptz,
  error         text,                  -- short message, never a secret or payload
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connector_runs_natural_key UNIQUE (connector, started_at),
  CONSTRAINT connector_runs_time_chk CHECK (finished_at >= started_at)
);
CREATE INDEX connector_runs_connector_idx ON connector_runs (connector, finished_at DESC);

SELECT noah_make_append_only('raw_payloads');
SELECT noah_make_append_only('observations');
SELECT noah_make_append_only('pump_states');
SELECT noah_make_append_only('rain_products');
SELECT noah_make_append_only('flood_reports');
SELECT noah_make_append_only('forecast_runs');
SELECT noah_make_append_only('forecasts');
SELECT noah_make_append_only('verifications');
SELECT noah_make_append_only('connector_runs');
