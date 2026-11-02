# Noah data store: schema notes (B-031, B-033, B-034)

Migrations: `db/migrations/NNNN_*.sql`, plain PostgreSQL 15+ with PostGIS, no Supabase-only features. Apply with `python -m noah.store.migrate` (env `NOAH_DATABASE_URL`). The runner records `schema_migrations(version, name, checksum, applied_at)`, takes an advisory lock, runs each file in one transaction, and refuses to continue if an applied file changed. Migrations only go forward. To fix a mistake, add a new migration.

## Tables

| Kind | Tables | Mutability |
|---|---|---|
| Reference (config) | `spatial_units`, `stations`, `station_identifiers`, `station_unit_map`, `pumps`, `users`, `operator_contacts` | Updatable (history in git or audit_log) |
| Versioned config | `polder_params` (by `valid_from`), `event_definitions` (by `version`; `agreed_with` may be filled once) | Append-only / guarded |
| Facts | `raw_payloads`, `observations`, `pump_states`, `rain_products`, `flood_reports`, `forecast_runs`, `forecasts`, `verifications`, `connector_runs`, `recommendations`, `recommendation_events`, `audit_log` | Append-only |

These tables were added beyond plan 03 (plan issue P7): `station_identifiers` (several source ids for one physical post, e.g. S1 `122` and S2 `PA. Manggarai`), `station_unit_map` (post to polder mapping for "DSDA Siaga as forecast"), `forecast_runs` (`run_id`; a non-null `run_id` is a backtest or replay and is excluded from live scores), `operator_contacts` (ciphertext only, encrypted by the application, no API grants), `raw_payloads` (index of object storage) and `connector_runs` (health).

One deviation from plan 03: the recommendation lifecycle (`sent_at`, `ack_by`, `ack_at`, `operator_action`, `note`) is stored as append-only `recommendation_events` rows, so `recommendations` itself never changes. The latest event of each kind is the current state.

## Append-only enforcement (guardrail 6)

`noah_make_append_only(table)` (migration 0001) does two things:
1. It adds `BEFORE UPDATE OR DELETE` (per row) and `BEFORE TRUNCATE` triggers that `RAISE`. They bind the table owner and superusers too. Only `ALTER TABLE ... DISABLE TRIGGER` or `session_replication_role = replica`, which need owner or superuser rights, can bypass them.
2. It runs `REVOKE UPDATE, DELETE, TRUNCATE` from `PUBLIC` and from `anon`, `authenticated`, `service_role`, `noah_app`, `noah_ingest` and `noah_reader` where those roles exist. An application role fails on privileges first. A role that is granted ALL, as Supabase defaults do, is still stopped by the trigger.

A correction is a new row with `supersedes_id`. CI (`db-migrations` job) proves that UPDATE, DELETE and TRUNCATE fail on every fact table.

## Idempotency keys (inserts use `ON CONFLICT DO NOTHING`, never `DO UPDATE`)

| Table | Key among original rows (`supersedes_id IS NULL`) | Corrections |
|---|---|---|
| observations | `(station_id, ts)` | `supersedes_id` unique (one correction per row, so corrections chain) |
| flood_reports | `(source, external_id, ts_start)` | same |
| pump_states | `(pump_id, source, ts)` | same |
| rain_products | `(source, kind, issued_at, valid_at, uri, supersedes_id)` | |
| forecasts | `(source, model_version, unit_id, issued_at, lead_min, run_id)` | |
| verifications | `(forecast_id, event_def_version, computed_at)` (latest `computed_at` wins) | |
| connector_runs | `(connector, started_at)` | |
| raw_payloads | `key` | |

The first delivery wins. Re-polls, restarts and repeated STALE readings add nothing. **A changed value for an existing key is silently ignored unless it is sent as a correction with `supersedes_id`.** For example, a BPBD report that later gets a `ts_end` must be written as a correction.

## Object storage (`noah.store.objects`)

Keys: `raw/{source}/{YYYY}/{MM}/{DD}/{fetched_at:%Y%m%dT%H%M%SZ}_{sha256[:12]}.{ext}`. Rasters use `rasters/...`, and `research/` is for scratch. The keys use UTC and contain no colons. The same payload always gets the same key, so a re-write is a no-op, and a different payload under an existing key raises `ObjectConflictError`. Backends:
- `NOAH_OBJECT_STORE=local` (default): files under `NOAH_OBJECT_STORE_DIR`.
- `NOAH_OBJECT_STORE=s3`: `NOAH_S3_BUCKET`, `NOAH_S3_PREFIX`, `NOAH_S3_ENDPOINT_URL`, `NOAH_S3_REGION`, with credentials from the standard `AWS_*` variables. This needs `boto3`, which is not pinned until the provider is chosen.

The lifecycle draft is in `config/object_storage_lifecycle.json`. `raw/` is never expired.

`raw_payloads.url` must not contain credentials or tokens. Connectors strip them before calling `write_raw`.

## Store API

`noah.store.postgres.PostgresSink(conn, objects)` implements `noah.records.Sink` and `noah.api.health.HealthSource` (`recent_runs`, `last_successful_run` over `connector_runs`; `PostgresHealthSource(conn)` is the read-only variant). Each write method runs in one transaction. Observations resolve stations through `station_identifiers`. If a station is unknown, the method raises `UnknownStationError` and writes nothing.

## Stations and Siaga thresholds (D12)

The configuration lives in `config/stations.yaml`. `python -m noah.store.stations` validates it, and `--apply` upserts it into the database. Upserts are allowed here because this is configuration. Provenance is recorded per station in `siaga_thresholds.source`, and the file header explains the values. `SiagaThresholds.classify(level_cm)` is the only place that compares a level against a threshold, using `>=`, which is what the S2 labels show. When a higher threshold is unknown, it reports `certain=False`.

Thresholds change over time. Cibalok and Jembatan Merah differ between 2020 and 2026, so a backtest must use thresholds that were valid at the time. The S2 2020 values are kept in `evidence.s2_2020`. A versioned threshold table is a follow-up.

## Not done here

- RLS policies. They are optional and only relevant on Supabase. Write them with the auth adapter (B-045 / G-069).
- Separate database roles per service (a read-only role for the API, an ingest role for the worker, a DDL role for `migrate`). Today all three read the same `NOAH_DATABASE_URL` from `deploy/<stack>.env`.

## Paths inside the image (F3)

The ml-service image (`ml-service/Dockerfile`, built from the repository root) carries `db/migrations/` and `config/` under `/app` and sets `NOAH_BASE_DIR=/app`. `noah.paths` resolves defaults in this order: `NOAH_MIGRATIONS_DIR` / `NOAH_STATIONS_CONFIG`, then `NOAH_BASE_DIR`, then the nearest ancestor of the package that contains `db/migrations` (the repository root in a checkout). So `python -m noah.store.migrate` and `python -m noah.store.stations --apply` work unchanged in a checkout, in CI and in the container. The compose service `migrate` runs both (`docs/ops/vps-layout.md`).

## Store factory (F1, F2)

`noah.store.factory` builds the store from the environment:
- `make_sink()`: the worker's sink (`--sink noah.store.factory:make_sink`). A `PostgresSink` over `NOAH_DATABASE_URL` and `object_store_from_env()`. It opens its connection on first use and reopens it when it is closed or broken. It raises `StoreConfigError` (the CLI prints it and exits 2) when `NOAH_DATABASE_URL` is missing, `NOAH_OBJECT_STORE=s3` has no bucket or no `boto3`, or the local object directory is not writable.
- `health_source_from_env()`: the API's health source, or `None` without `NOAH_DATABASE_URL` (health then answers 503 `{"status": "unconfigured"}`). One short-lived, read-only connection per health request, closed afterwards; no pool, no idle connection.

Connections use autocommit (every `conn.transaction()` block is a real transaction) and `prepare_threshold=None`, so a transaction-mode pooler such as Supabase Supavisor or PgBouncer works. The URL is never logged or put in an error message.
