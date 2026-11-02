# VPS layout: production and staging on one host (B-030, G-103)

Budget (guardrail 14): one VPS (about 4 vCPU and 8 GB), managed Postgres/PostGIS, and object storage. **Human step (Ari):** choose the VPS provider, the managed Postgres and the object storage. Nothing here is wired to a provider yet.

## Services per stack

Each app stack (`noah-prod`, `noah-staging`) runs the same four services from `docker-compose.yml`:

| Service | Image | Command | Started by |
| --- | --- | --- | --- |
| `web` | `noah-web:<stack>-<tag>` (root `Dockerfile`) | `node server.js` | `up -d` |
| `ml-api` | `noah-ml-api:<stack>-<tag>` (`ml-service/Dockerfile`) | `uvicorn --factory noah.api.app:create_app` | `up -d` |
| `worker` | same image as `ml-api` | `python -m noah.connectors run --sink noah.store.factory:make_sink` | `up -d` |
| `migrate` | same image as `ml-api` | `python -m noah.store.migrate && python -m noah.store.stations --apply` | `run --rm migrate` only (profile `migrate`) |

The shared edge project (`noah-edge`) runs `caddy` only (profile `edge`).

The ml-service image is built from the repository root (`context: .`, `dockerfile: ml-service/Dockerfile`), so it carries `db/migrations/` and `config/` under `/app`; `NOAH_BASE_DIR=/app` makes the default paths resolve there (`docs/data/schema.md`). The build context is filtered by the allowlist `ml-service/Dockerfile.dockerignore`, which BuildKit (the default builder in Docker 23+ and Compose v2) uses instead of the root `.dockerignore`.

## Networks

```
Internet ──80/443──> caddy ─┬─ prod.<domain>    -> prod-web:3000      network noah-edge (shared, external)
                            └─ staging.<domain> -> staging-web:3000

per stack:
  web ──internal──> ml-api:8000                 network <stack>_internal  (internal: true, no route out)
  ml-api ─┐
  worker ─┼─egress──> managed Postgres          network <stack>_egress    (bridge, outbound NAT only)
  migrate ┘           object storage (worker)
                      public sources (worker: DSDA, BPBD, BMKG, PetaBencana)
  web ──noah-edge──> Supabase (outbound)
```

| Network | Members | Purpose | Inbound from outside |
| --- | --- | --- | --- |
| `noah-edge` (external, shared) | caddy, web of each stack (alias `prod-web` / `staging-web`) | Caddy reaches the web containers; web's outbound access | Only through Caddy's published 80/443 |
| `<stack>_internal` (`internal: true`) | web, ml-api | The web -> ml-api path (`ML_API_URL=http://ml-api:8000`). Docker gives it no gateway, so traffic on it never leaves the host. | None |
| `<stack>_egress` (bridge) | ml-api, worker, migrate | Outbound connections to the managed Postgres; for the worker also object storage and the public data sources | None: no service on it publishes a port |

- Only Caddy (Apache-2.0) publishes ports. Host firewall: allow 22 (admin IPs only), 80 and 443. Nothing else. The CI docker job fails if any app-stack service publishes a port.
- web is not on `egress`, and worker and migrate are not on `internal`: the API port is reachable only from the stack's own web container. Prod and staging have separate `internal` and `egress` networks, so a staging container cannot reach prod's API.
- `ml-api` needs egress only for Postgres. Docker cannot limit a bridge network by destination. If wanted, restrict it on the host with `DOCKER-USER` iptables rules (allow the Postgres host and port from the egress subnet, plus DNS and 443 for the worker, then drop). Pin the subnet with `ipam` first. This is an optional host step, not in compose.
- All containers run as non-root (uid 10001), read-only root filesystem, `no-new-privileges`, all capabilities dropped, rotated json logs.

## Healthchecks

- `web`: liveness only. The root `Dockerfile` probes `/robots.txt`, which is static and allowlisted by `middleware.ts`, and accepts any status below 500. It does not call the API.
- `ml-api`: liveness only. `ml-service/Dockerfile` probes `/api/v1/openapi.json`. `web` waits for this (`depends_on: service_healthy`).
- `worker`, `migrate`: Docker healthcheck disabled (no HTTP server). A dead or stuck worker shows up as stale connectors in `/api/v1/health`.
- `/api/v1/health` is the freshness report for the uptime monitor (B-040), not a container check. It returns 503 whenever a connector is stale, and 503 `{"status": "unconfigured"}` while `NOAH_DATABASE_URL` is unset, so it must never gate a container.

## Memory plan for 8 GB

| Service | prod | staging |
| --- | --- | --- |
| web (`NOAH_WEB_MEM`) | 1g | 768m |
| ml-api (`NOAH_ML_MEM`) | 1g | 768m |
| worker (`NOAH_WORKER_MEM`) | 512m | 384m |
| caddy | 128m (shared) | |

That leaves about 3 GB for the OS, the page cache and the `migrate` job (short-lived). Set the limits in each stack's env file. CPU: `NOAH_WEB_CPUS`, `NOAH_ML_CPUS`, `NOAH_WORKER_CPUS`.

## Env files (never committed; `deploy/*.env` is git-ignored)

`/srv/noah/deploy/prod.env` and `/srv/noah/deploy/staging.env`, mode 600, owned by the deploy user. Each holds compose interpolation values and the container runtime env. Variable names are in `.env.example`. Minimum:

```
NOAH_STACK=prod                      # or staging
NOAH_IMAGE_TAG=<git sha>
NOAH_DEMO_MODE=false                 # staging may set true; prod never
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # different project or key per stack
SENTRY_DSN=...                       # same Sentry project, environment tag = NOAH_STACK
NEXT_PUBLIC_SENTRY_DSN=...
NOAH_CORS_ORIGINS=https://prod.<domain>
NOAH_DATABASE_URL=...                # managed Postgres; a different database per stack
NOAH_OBJECT_STORE=local              # or s3 (+ NOAH_S3_BUCKET, NOAH_S3_PREFIX=noah-prod, ...)
NOAH_CONTACT_EMAIL=...               # in the connectors' User-Agent
NOAH_WEB_MEM=1g
NOAH_ML_MEM=1g
NOAH_WORKER_MEM=512m
```

- `NOAH_DATABASE_URL` is read by `ml-api` (health), `worker` (writes) and `migrate` (DDL). The worker exits 2 with "NOAH_DATABASE_URL is not set" if it is missing; the API starts and reports `unconfigured`. Separate roles per service are a follow-up (`docs/data/schema.md`).
- With `NOAH_OBJECT_STORE=local` the worker writes raw payloads to the per-stack named volume `<stack>_objects` (mounted at `/var/lib/noah/objects`). Back it up, or switch to `s3` once the provider is chosen (`boto3` must then be pinned in `ml-service/requirements.txt`).

`deploy/edge.env` holds `NOAH_PROD_DOMAIN` and `NOAH_STAGING_DOMAIN`. Note that compose resolves `deploy/staging.env` even for the edge project, so the file must exist on the host.

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so each stack builds its own web image (`noah-web:<stack>-<tag>`). The app refuses to start in production when a required server variable is missing (`instrumentation.ts`).

## Commands

```sh
docker network create noah-edge                                                    # once
docker compose -p noah-edge    --env-file deploy/edge.env    --profile edge up -d caddy

# each deploy, staging first
docker compose -p noah-staging --env-file deploy/staging.env build
docker compose -p noah-staging --env-file deploy/staging.env run --rm migrate      # schema + stations
docker compose -p noah-staging --env-file deploy/staging.env up -d                 # web, ml-api, worker
# after staging is verified, the same three commands with -p noah-prod --env-file deploy/prod.env
```

`migrate` is forward-only, takes an advisory lock and is a no-op when nothing is pending, so running it on every deploy is safe. It is still an explicit step, so a schema change never happens as a side effect of `up`. Run it before `up`: a worker started on an empty schema records failed runs until the tables exist.

Rollback: set `NOAH_IMAGE_TAG` to the previous tag and run `up -d` again (the images stay on the host). Migrations are never rolled back; a bad migration is fixed by a new one.

## Still open

- Staging should not be publicly reachable. Until OIDC (W3), put it behind Caddy `basic_auth` or an IP allowlist (B-010 interim gate covers the app side).
- Python lockfile for `ml-service` (uv or pip-tools). `requirements.txt` is pinned with `==` but transitive dependencies are not locked.
- Daily managed-Postgres backup and one tested restore; uptime monitor on `/api/v1/health` and the stale-connector alert (over 15 minutes) come with B-040.
- Optional `DOCKER-USER` egress rules (see Networks).
