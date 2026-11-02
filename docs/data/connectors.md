# Connectors (B-035 to B-040)

Code: `ml-service/src/noah/connectors/`. Contract: `ml-service/src/noah/records.py` (records and `Sink`). Fixtures: `ml-service/tests/connectors/fixtures/`. Endpoints were probed on 2026-11-02 with at most two GETs per source, identified as `NoahAI/0.1 (+contact: ...)`.

## Running

```
python -m noah.connectors run --once --dry-run [--connector s1]   # in-memory sink, prints counts (real GETs)
python -m noah.connectors run --once --sink module:factory        # one pass into a real sink
python -m noah.connectors run --sink module:factory               # loop forever
python -m noah.connectors run --sink noah.store.factory:make_sink # the worker (compose service `worker`)
```

`--sink` (or `NOAH_SINK`) names a zero-argument factory that returns a `Sink`. The store's factory is `noah.store.factory:make_sink` (Postgres via `NOAH_DATABASE_URL` plus the object store from `NOAH_OBJECT_STORE*`; see `docs/data/schema.md`). The CLI never guesses a sink. If the factory fails (for example `NOAH_DATABASE_URL` is not set), the CLI prints the reason with any URL redacted and exits 2 before a connector runs. Aliases: `s1`, `s4`, `s5`, `s5img`, `s15`.

Environment:

| Variable | Use |
|---|---|
| `NOAH_CONTACT_EMAIL` | Contact address in the User-Agent. Set it in every deployment. |
| `NOAH_S4_FEATURE_URL` | BPBD RT layer `.../FeatureServer/<n>/query?where=1%3D1&outFields=*&f=json`. S4 stays disabled until it is set. |
| `NOAH_S5_IMAGE_URL` | A confirmed public BMKG nowcast image. The image connector stays disabled until it is set. |
| `NOAH_SINK` | Sink factory for non-dry runs, e.g. `noah.store.factory:make_sink`. |
| `NOAH_DATABASE_URL` | Postgres for `make_sink` (worker) and for the API's health source. Required by the worker. |
| `NOAH_OBJECT_STORE`, `NOAH_OBJECT_STORE_DIR`, `NOAH_S3_*` | Raw payload storage for `make_sink` (`docs/data/schema.md`). |

## Framework

- **One run:** fetch, then `write_raw`, parse, drop rows already written, append rows, `record_run`. A run never raises. Exceptions become `FAILED` runs with a short error that has URLs stripped, so one connector cannot stop the others.
- **Politeness:** each connector has a `min_interval_s` equal to the source cadence (S1 5 min, S5 10 min, S15 5 min, S4 60 min), and the configured interval cannot be shorter. There is one request per run and no retry inside a run. Requests use a 20 s timeout and conditional GET (`If-None-Match` / `If-Modified-Since`). A body identical to the last one is neither stored nor parsed again.
- **Backoff:** after `n` consecutive failures the next run waits `min(1 h, interval * 2^n) * j`, never less than the interval and never less than a `Retry-After`. The jitter `j` is in [1, 1.25) and comes from `sha256("<connector>:<n>")`. It is deterministic, and no random generator is used (guardrail 5).
- **Scheduler:** a plain loop, not APScheduler. There are five fixed-interval jobs in one process, with no cron syntax, no job store and no threads. The loop needs no dependency, and its clock and sleep can be injected for tests. The container supervisor restarts the process, and `/api/v1/health` detects a dead loop.
- **Quality:** values are flagged, never dropped. Each row has one flag, chosen by priority MISSING_UNIT > SUSPECT > STALE > OK. `FloodReport` has no flag column, so its flag goes in `meta.quality_flag`.
- **Idempotent re-poll:** per station, only timestamps newer than the last one written are appended. Reports and products are deduplicated by key. This memory is per process, so **the store must also enforce uniqueness**: (station, ts) for observations, (source, external_id, ts_start) for reports, and (source, identifier, issued_at, valid_at) for products.

## Sources

### S1 Posko Banjir DSDA: live
- `GET https://poskobanjir.dsdadki.web.id/` returns 200 `text/html`. It is a server-rendered ASP.NET DevExpress grid with 37 posts and needs no JavaScript.
- The XML endpoint is not linked from the page. `/datatmalaststatus.xml` returned 404, so the XML endpoint still needs confirmation from DSDA (Q3).
- **Unit (audit Q2, resolved):** the table header reads "Tinggi Air (cm)" and shows whole cm. The row's `onclick="ShowPopup(...)"` carries the raw level and the Siaga 1/2/3 thresholds in **mm**. For Manggarai the page showed 534 in the table, raw `5340`, and thresholds `9500/8500/7500`, which are exactly the official 950/850/750 cm. All 37 rows satisfy raw/10 == table, and the S2 archive (mm) matches the raw field. The parser uses the raw mm value converted to cm (1 mm resolution) and flags SUSPECT if raw/10 and the table value disagree by more than 1 cm. If the header unit ever changes, the parser stops with an error rather than scaling silently.
- Times are `dd/mm/yyyy` plus `HH:MM` in WIB, converted to UTC. A reading more than 60 min older than the fetch is flagged STALE. On the probe day Karet was 1 day old and Kaliduri 3 days old. A reading more than 10 min in the future is flagged SUSPECT.
- `external_id` is `ID_PINTU_AIR` from the onclick (Manggarai `122`). `station_catalog()` extracts name, river, coordinates and Siaga thresholds in cm for the `stations` seed. The newer posts carry `5000/5000/5000` mm, which look like placeholders; confirm them with DSDA.
- The fixture has the ASP.NET `__VIEWSTATE` and DevExpress callback state removed, and the visitor IP that the page echoes removed.

### S4 BPBD Info Banjir: needs_endpoint_confirmation (disabled)
- `https://bpbd.jakarta.go.id/infobanjir` only embeds an ArcGIS Dashboard, Jakarta Satu `c2b19d6243dd4a2f80fa1e55481fdb11`, which needs JavaScript.
- The public dashboard definition (`/portal/sharing/rest/content/items/<id>/data?f=json`) points to web map `3929103a8101453fb6f137605fda6d85`. Its RT layer has the fields `WADMKK, WADMKD, WADMRW, WADMRT, TMA, KATEGORI, LUASWH, LAST_UPDATE, OBJECTID`, and a gate layer has `PINTU_AIR, KETINGGIAN_AIR_CM, STATUS_N, TANGGAL, WAKTU`. The map is titled "Banjir BPBD - DEV".
- The FeatureServer URL was not resolved. The parser reads the standard ArcGIS `query?f=json` format and is tested on a **constructed** fixture only.
- Normalization:
  - `ts_start = LAST_UPDATE` (epoch ms, UTC). The layer is a snapshot, so `ts_end` is None.
  - `depth_cm = None` and `TMA` is kept raw, because its unit is undocumented.
  - `unit_code = None` because no RT code field is visible; kelurahan, RW and RT names go in `meta`.

### S5 BMKG nowcast: images needs_endpoint_confirmation; warnings feed live
- `https://nowcasting.bmkg.go.id/` returned 403 with a Cloudflare JavaScript challenge. It is not bypassed, so no image URL is confirmed (Q5).
- `https://www.bmkg.go.id/alerts/nowcast/id` returned 200 `application/xml`, an RSS feed of CAP nowcast warnings marked "public domain". One `RainProduct(kind=nowcast, source=s5_bmkg_nowcast)` is written per DKI (`CJK…`) warning:
  - `issued_at = pubDate`, with the offset respected (+07/+08/+09).
  - `valid_at` is the onset parsed from the description. `meta.expires_at` is the "hingga …" time.
  - `uri` is the raw feed's object key.
  - The regions are configurable. Add `JB` and `BT` for the Bogor, Depok, Bekasi and Tangerang upstream areas.
- These are BMKG's own warnings. They are stored for operators only and never republished (guardrail 1).
- The image connector (`s5_bmkg_nowcast_image`) stores an image as the raw payload plus a `RainProduct` pointing to it, without parsing the image. `issued_at` comes from `Last-Modified`, or the fetch time if that is missing, as recorded in `meta.issued_at_from`.

### S15 PetaBencana: live
- `GET https://data.petabencana.id/reports?admin=ID-JK&timeperiod=<s>&geoformat=geojson` returns 200 `{statusCode, result: FeatureCollection}` with a weak ETag and `max-age=60`.
- The connector polls every 5 min with `timeperiod=3600`. Overlapping windows are deduplicated by `pkey`. Unknown window labels are rejected instead of being widened, which fixes G-039.
- Only `disaster_type == "flood"` inside DKI is kept: `instance_region_code == "ID-JK"` or a BPS `region_code` starting `31`.
  - `ts_start = created_at` (UTC, offset required).
  - `depth_cm = report_data.flood_depth`, in cm per PetaBencana's documentation. **No flood report was seen yet**, so confirm this on the first one.
  - `unit_code = tags.local_area_id`.
  - Coordinates are rounded to 4 decimals.
  - Text, title, photo and report URLs are never copied into records, and are stripped from the fixture (guardrail 3).

## Health (`GET /api/v1/health`, B-040)

The FastAPI route reads a `HealthSource`, defined in `noah/api/health.py` as `recent_runs(connector, limit)` and `last_successful_run(connector)`. `MemorySink` implements it, and the Postgres store implements it over `connector_runs`. `create_app()` wires the Postgres reader when `NOAH_DATABASE_URL` is set (`noah.store.factory.health_source_from_env`: one short-lived connection per request). Each connector reports `enabled, freshness, stale_after_min, last_run_at, last_status, last_success_at, newest_ts, age_min, consecutive_failures, stale`.

How `age_min` is measured:
- **`freshness=data`** (S1, the image): minutes since the newest source timestamp, so a frozen DSDA page goes stale even when polling works.
- **`freshness=run`** (S4, the S5 feed, S15): minutes since the last successful run, because silence is normal for event sources.

When a connector counts as stale:
- `stale` means `age_min > stale_after_min`, or the connector has never had a successful run.
- `stale_after_min` is 15 everywhere except S4, which is 75 because it polls hourly.

Status codes:
- **200:** every enabled connector is fresh and none has a failed last run.
- **503:** any enabled connector is stale or its last run failed. The body is the same report.
- **503 `{"status": "unconfigured"}`:** `NOAH_DATABASE_URL` is not set, so there is no health source. The API still starts.
- **503 with the standard error body `unavailable`:** the health source failed (for example the database is unreachable). No error text is returned.

Health is a freshness report for the uptime monitor, not a container liveness probe. The Docker healthchecks probe `/api/v1/openapi.json` (ml-api) and `/robots.txt` (web), so a stale connector never makes a container unhealthy or blocks `web` from starting.

Run error texts are never returned. Disabled connectors are listed and do not affect the status. The Next.js route `app/api/v1/health/route.ts` proxies to `NOAH_API_URL` (falling back to `ML_API_URL`) with a 5 s timeout. It returns 501 `not_configured` when neither is set and 503 `unavailable` when the upstream is unreachable.

Not done here: the alert to the admin channel (Sentry or email) when a connector is stale for more than 15 min or fails twice. `consecutive_failures` is exposed for it.

## Open questions

- **DSDA:** the XML endpoint URL and the permitted polling rate (Q3). The datum of each post. The real Siaga thresholds for the posts showing 5000 mm. Why Karet and Kaliduri repeat old readings.
- **BPBD:** the FeatureServer layer URL and whether automated reading is permitted. The unit of `TMA` and the meaning of `KATEGORI`. Whether an RT code field exists. The meaning of the "DEV" map title (production or not). The archive (B-043).
- **BMKG:** a stable public nowcast image URL that is not behind the bot challenge, and its cadence (Q5). The research data agreement for gridded nowcasts. Whether the CAP feed can be polled every 10 min.
- **PetaBencana:** the terms and rate limits (Q6). Confirmation that `flood_depth` is in cm. Whether `local_area_id` maps to RW or kelurahan in Jakarta.
