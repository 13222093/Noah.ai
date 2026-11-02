# ml-service: Noah v1 API (skeleton)

This directory will become the v1 API described in `docs/plan/03_TARGET_ARCHITECTURE.md`.
The hackathon forecast core (LSTM, "physics engine", GOD MODE, scenarios) and the
Roboflow/YOLO CV path were removed in W1 (B-017, B-018). **Nothing here serves a forecast.**

## Layout

```
ml-service/
  src/noah/
    timeunits.py      UTC/WIB helpers and unit converters (B-029, Python half)
    api/
      app.py          create_app() factory
      settings.py     env-only settings (NOAH_ENV, NOAH_CORS_ORIGINS)
      errors.py       structured error body and handlers
      v1.py           /api/v1 routes
  tests/              pytest
  data/               tma_2020.xlsx.csv (S2 archive, moves to object storage in B-041);
                      hujan_bogor2022.csv (parked, G-045)
```

## Contracts

- Errors are always non-2xx with `{"error": {"code", "message", "details"}}`.
- `GET /api/v1/health` reports per-connector freshness from `connector_runs` when `NOAH_DATABASE_URL`
  is set (200 fresh, 503 stale or failing); without it, 503 `{"status": "unconfigured"}`.
  Details: `docs/data/connectors.md`.
- OpenAPI: `/api/v1/openapi.json`, docs at `/api/v1/docs`.
- CORS is off unless `NOAH_CORS_ORIGINS` lists exact origins (comma separated); `*` is refused.
- Time: aware UTC everywhere; WIB (fixed UTC+07:00) only when parsing source-local
  timestamps (`parse_wib_local`) and for display (`format_wib`). Naive datetimes raise.
- Units: water level in cm (`length_to_cm` from mm, dm, m), discharge in m3/s (`lps_to_m3s`).

## Run

```bash
cd ml-service
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
PYTHONPATH=src uvicorn --factory noah.api.app:create_app --port 8000
```

## Image

One image serves the API (default CMD), the connector worker
(`python -m noah.connectors run --sink noah.store.factory:make_sink`) and the
`migrate` job. It is built from the **repository root** so it can carry
`db/migrations/` and `config/`:

```bash
docker build -f ml-service/Dockerfile -t noah-ml-api .   # from the repo root
```

The context is filtered by `ml-service/Dockerfile.dockerignore` (an allowlist;
needs BuildKit, the default builder). Compose services: `docs/ops/vps-layout.md`.
