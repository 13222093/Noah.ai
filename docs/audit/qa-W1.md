# QA verification: roadmap week W1

Verifier: `qa-verifier` agent. Date: 2026-11-02. Branch `w1-foundation`, uncommitted working tree (`git diff HEAD --stat`: 222 files changed, +8160 / -49939, plus about 150 untracked new files). Nothing is committed, pushed, deployed or connected to a database. No key has been rotated yet.

Scope: W1 row of `docs/plan/09_ROADMAP_AND_ACCEPTANCE.md`, the Definition of done, `docs/plan/10_GUARDRAILS.md`, the non-goals in `docs/plan/01_PRODUCT_BRIEF.md`, and B-001 to B-043 in `docs/audit/BACKLOG.md`.

Legend: PASS = the clause holds in the working tree. PARTIAL = some of it holds. FAIL = a code gap blocks the clause. BLOCKED-ON-HUMAN = waiting on Ari or an external party. "Code-complete" means the code and tests exist. It does not mean anything is running.

---

## 1. Acceptance table (W1 row of 09)

| # | Clause | Verdict | Evidence |
|---|---|---|---|
| A1 | Leaked keys rotated and removed (D10, D11) | **BLOCKED-ON-HUMAN** (removal is code-complete) | Working tree: no JWT, Roboflow, OWM, Gemini or Twilio literal (grep in section 3). `scripts/seed-regions.mjs` now reads env only and fails closed. `ml-service/src/yolo_model.py` is staged for deletion. `.gitleaks.toml` has rules for supabase-jwt, supabase-secret-key, roboflow and openweathermap. Still exposed: `HEAD:scripts/seed-regions.mjs` holds a Supabase JWT, and `git log --all -G` finds it in 1 commit. Rotation of B-001, B-002 and B-003 has not been confirmed. The history rewrite (B-006) needs approval. |
| A2 | All fake data paths removed or flagged (D1 to D7) | **PASS** (code-complete, uncommitted) | D1 `app/api/water-level`, `sensor-simulator`, `rainfall-dual` and the CSVs: deleted. D2 to D4 LSTM, physics engine, GOD MODE, `scenarios.py`, `main.py` and artifacts: deleted. D5 `lib/mock-data.ts`: deleted, and `/dashboard` redirects to the empty-state Ringkasan. D6 evacuation and routing: deleted. D7 flood-zone mock, CCTV sim and the flood-map page: deleted. `NOAH_DEMO_MODE` (`lib/demo.ts`) is in place and `SimulasiBanner` is in `app/layout.tsx`. Leftovers outside D1 to D7: findings F9, F10 and F11. |
| A3 | CI runs tests | **PARTIAL** | `.github/workflows/ci.yml` defines vitest, pytest, a PostGIS migrations job, guardrails, gitleaks, build, docker and licences jobs, and the job definitions look correct (section 5). CI has never run, because the W1 work is not committed or pushed. The lint job does nothing (F7). The full-history gitleaks step fails by design until B-006. Making these checks required on `main` is a step for Ari. |
| A4 | Target schema migrated | **PARTIAL** (code-complete, never applied) | `db/migrations/0001..0004` cover PostGIS, the append-only guard functions, reference, facts and operations tables, `supersedes_id`, `connector_runs` and encrypted `operator_contacts`. The runner is `noah.store.migrate`. Static and pglast syntax tests pass. `tests/store/test_postgres_integration.py` was **skipped** locally (no DB). No database exists, and the choice of database is Ari's call (B-031). |
| A5 | Connectors S1, S4, S5 (images), S15 running and recording to the store; health shows freshness | **FAIL** (parts BLOCKED-ON-HUMAN) | Parsers and the framework are code-complete and tested on saved fixtures (286 pytest pass). Nothing runs, and the code cannot yet record to the store in a deployment: there is no sink factory for `NOAH_SINK` (F1), no worker service (F1), the API has no health source (F2) and the image lacks the migrations and config (F3). S4 is disabled until `NOAH_S4_FEATURE_URL` is confirmed with BPBD. The S5 image connector is disabled because `nowcasting.bmkg.go.id` sits behind a Cloudflare challenge; only the S5 CAP warning feed is enabled. S15 has not yet seen a flood report. |
| A6 | Station config with official Siaga thresholds | **PARTIAL** (BLOCKED-ON-HUMAN for confirmation) | `config/stations.yaml` validates: 38 stations. Only Manggarai is `dsda_official` (750/850/950 cm, tested in `tests/store/test_stations.py`). 24 posts use `dsda_posko_banjir_page` (`needs_DSDA_confirmation`) and 13 are unknown (null, never guessed). The inverted severity order is fixed (`SIAGA_LEVELS`). No D12 literals (400/700/850) remain in live code. The config has not been loaded into a DB. |
| A7 | Readiness scorecard computed for candidate polders | **PASS** (draft) | `docs/readiness/polder_scorecard.md` (DRAFT v0.1) and `config/polder_candidates.yaml` cover 4 candidates, 9 weighted criteria and cited sources R1 to R12. c8 (DSDA willingness) can only come from DSDA, and the lighthouse decision is Ari's and DSDA's. |

Definition of done: "Code merged with tests that CI runs" is **not met**, because nothing is merged and CI has not run. "No guardrail violated" is met in the working tree (section 3). "Docs updated" is mostly met; F12 is the exception.

---

## 2. Backlog items B-001 to B-043

| Item | Status | Evidence / gap |
|---|---|---|
| B-001 Supabase key | human step pending | Literal removed in the working tree. `seed-regions.mjs` reads env only. A gitleaks rule exists. Still pending: rotation, the Supabase log review since 2026-03-12, and purging HEAD and history (B-006). The backlog said to delete `seed-regions.mjs`; it was kept and made env-only instead (F20). |
| B-002 Roboflow key | human step pending | `yolo_model.py` is staged for deletion, `docker-compose.yml` has no `ROBOFLOW_*`, and a gitleaks rule exists. Revocation is pending. |
| B-003 OWM keys | human step pending | No `NEXT_PUBLIC_OPENWEATHER*` in code (guardrail rule `no-public-owm`). The CI build job greps the bundle. Revocation is pending. |
| B-004 Secret scanning | partial / human | `.pre-commit-config.yaml`, the gitleaks CI job and the `public/sw.js` allowlist exist. No evidence that a planted secret fails both the hook and CI. GitHub push protection is Ari's step. |
| B-005 Env hygiene | partial | `supabase/.temp/` is untracked and ignored (`git ls-files` returns 0). `.env.example` has placeholders only. `test-supabase.js` is deleted. The second image host is removed (`remotePatterns: []`). There is no zod or pydantic-settings schema: `instrumentation.ts` checks required env only in production, and `ml-service/src/noah/api/settings.py` is a plain dataclass. |
| B-006 History rewrite | human step pending (approval) | Runbook in `docs/ops/history-rewrite.md`. Not executed. |
| B-007 SMS pipeline | done | The routes, page and `twilio` are gone. `tests/guardrails/deleted-routes.test.ts` and the guardrails deny-list cover them. Dead i18n strings remain (F9). |
| B-008 Public alerts UI | done (code) | The alerts route and page, `AlertCountContext`, `PeringatanBencanaCard` and `BottomTile` are deleted. Rendered UI has no "peringatan". Dead i18n strings remain (F9). |
| B-009 Public site | partial / human | `public/*.html`, the landing JS and CSS, `sitemap.ts` and the education, contact and privacy pages are deleted. `app/robots.ts` disallows all crawlers, `X-Robots-Tag` is set, `<html lang="id">` is in place and `public/sw.js` is a kill-switch. The Vercel and `noah.ai.id` decision is Ari's. I did not check whether the education text was moved to `docs/`. |
| B-010 Access gate | partial | `middleware.ts` fails closed, has an allowlist and returns a uniform 401 (section 6). Port 8000 is not published in compose. `/api/health` is deleted. **No tests** (F6). |
| B-011 PII lockdown | human step pending | `supabase/manual/B-011_lockdown_pii.sql` (with verification) is prepared but not run. |
| B-012 Citizen intake | done (code) | Pages, routes and components are deleted. `reporter_contact` appears only in legacy migrations and a scrub test. `Untitled-1.txt` and `Untitled-2.txt` still exist locally (gitignored). |
| B-013 PDP purge | human step pending (approval and Legal) | `supabase/manual/B-013_pdp_purge.sql` is prepared. |
| B-014 SSRF and LLM proxies | done | The five routes are deleted. The chatbot is deleted and parked in `docs/parked/`. A test accepts either a deletion or a 410. |
| B-015 Demo flag and lint | partial | `lib/demo.ts`, `SimulasiBanner` and `SimulasiBadge` exist. `scripts/check-guardrails.mjs` and its 9 tests run. The `Math.random` nonce is gone (`src/lib/rateLimiter.ts` is deleted). The ESLint rule is not enforced because eslint is not installed (F7). There is no ruff rule; the guardrails script covers `np.random`. |
| B-016 D1 replay | done | Routes and CSVs are deleted. `DATASET_FINAL_TRAINING` matches nothing. |
| B-017 Forecast core | done | Artifacts, `lstm_model.py`, `scenarios.py`, `main.py` and `metrics.py` are deleted. TensorFlow is out of `requirements.txt`. `app/api/predict` was deleted (404) rather than made to return 410, which is acceptable. No R2 or accuracy reporting remains. |
| B-018 CV / AGPL | done | `yolo_model.py`, the weights and the verify-visual route and page are deleted. No `ultralytics`. |
| B-019 Dashboard mocks | done (code) | No `*_MOCK` or `generateMock*`. `/dashboard` redirects to Ringkasan, which shows only empty states. Orphaned legacy components remain (F10). |
| B-020 Shelters and routing | done | Deleted, including `leaflet-routing-machine`. |
| B-021 Fake layers and pages | done | Deleted. |
| B-022 Out-of-scope layers | done (code) | No OWM, WAQI, aqicn, Overpass or Nominatim request in code. An orphaned `RadarLayer.tsx` (RainViewer) is not rendered. |
| B-023 Capability claims | partial | README rewritten, and `documentation/` moved to `docs/archive/hackathon-2025/`. The i18n strings "LSTM (50%)", "historical replay ... live" and "Real-time" remain (F9). |
| B-024 Tests run | done | vitest: 6 files, 64 tests. pytest: 286 passed, 1 skipped. |
| B-025 Full CI | partial / human | Jobs defined (section 5), but lint is a no-op, CI has never run, and branch protection is Ari's step. |
| B-026 Licences | partial | `docs/LICENSES.md`, `scripts/check-licenses.mjs` (0 denied, 26 flagged for review) and the SBOM job exist. The Python section is stale (F12). Hippocratic-2.1 was raised for Legal (L1); no answer yet. |
| B-027 Unbudgeted services | partial / human | `twilio`, Gemini, Upstash and the routing package are removed. `typescript` and `tailwindcss` are still in `dependencies`. Versions are unpinned (`^`, and `latest` for jest-dom and jsdom). Account cancellations are Ari's. |
| B-028 Sentry | partial | The PII scrubber exists (`tests/platform/sentry-scrub.test.ts`) and env tags are set. No `sentry-sdk` in Python and no cron monitors. Delivery to Sentry is not verified. |
| B-029 Time and units | partial | `lib/time.ts` (36 tests) and `noah/timeunits.py` (tests) exist. No lint rule for bare `getHours` or `toLocale*`. One `toLocaleTimeString` without `timeZone` remains, in the orphaned `TimelineScrubber.tsx`. |
| B-030 Containers and VPS | partial / human | Both images run as non-root, `.dockerignore` files exist, and the compose prod/staging and Caddy edge are written. No Python lockfile. The ML image lacks the migrations and config (F3). No worker service. The network has no egress for the DB (F4). Choosing the VPS and object storage is Ari's. |
| B-031 Target schema | partial (code-complete, unverified) | See A4. The choice of database is Ari's. |
| B-032 Drop legacy | human step pending | `supabase/manual/B-032_drop_legacy.sql` is prepared. `supabase/migrations/*` and `supabase/seed.sql` are still in the tree (F14). |
| B-033 Object storage | partial | `noah/store/objects.py` (local and S3, `raw_ref`, content-hash keys), `config/object_storage_lifecycle.json` and `tests/store/test_objects.py` exist. No bucket exists, and `boto3` is not in the requirements. |
| B-034 Station config | partial | See A6. |
| B-035 Connector framework | done (code) | `connectors/base.py` has conditional GET, an identified User-Agent, raw-first storage, quality flags and isolation. `scheduler.py` is a plain loop instead of APScheduler, with the choice justified in its docstring. Tests cover backoff, re-poll and flags. The missing deployment wiring is tracked in F1. |
| B-036 S1 | partial | HTML parser, fixture and tests exist. Not running. The XML endpoint waits on DSDA. |
| B-037 S4 | partial / blocked | Disabled until `NOAH_S4_FEATURE_URL` is set. The parser has been tested only on a constructed fixture. |
| B-038 S5 images | partial / blocked | The image connector is disabled (Cloudflare challenge, not bypassed). A CAP feed connector exists instead. No 24 h of frames. |
| B-039 S15 | partial | Connector exists, with `timeperiod` in seconds, tested. Not running. The legacy `app/api/disaster-proxy` still has the old bug (F11). |
| B-040 Health | partial | `api/health.py`, `api/v1.py`, `app/api/v1/health/route.ts` and tests exist. Not wired to Postgres (F2). No admin alert, no uptime monitor, and no staging test. |
| B-041 S2 import | partial | Importer and tests (duplicates, negatives) exist. `ml-service/data/tma_2020.xlsx.csv` is still tracked in git (F13). Not imported into any DB. |
| B-042 Scorecard | done (draft) | See A7. |
| B-043 Data requests | human step pending | 9 drafts in `docs/requests/`. Sending them is Ari's step. |

Totals: done 14, partial 21 (several also need a human step), human step pending 8. Within the partial rows, 2 are also blocked on an external endpoint (B-037, B-038).

---

## 3. Banned-pattern greps

File set: `git ls-files --cached --others --exclude-standard`, minus `node_modules/`, `.next/`, `.git/`, `files/`, `files.zip` and `docs/archive/`. That leaves 262 files; 209 remain after dropping docs, `*.md` and `.claude/`.

| Pattern | Result |
|---|---|
| `Math.random` | None in production code. Hits only in docs, agent prompts, the guardrail script and its tests, and `.eslintrc.json`. |
| `np.random`, unseeded `random.` in Python | None anywhere in `ml-service/` (tests included). |
| Hardcoded keys and JWTs (JWT, `AIza`, `sk-`, `sk_live_`, Twilio SID, `ghp_`, private keys, `key=...{20,}`) | None in the working tree. `.env.local` is gitignored (`.gitignore:56`); only `.env.example` is tracked, with placeholders. **HEAD** still holds a Supabase JWT at `scripts/seed-regions.mjs` (fixed in the working tree), and history holds it in 1 commit. Roboflow is at HEAD in `ml-service/src/yolo_model.py`, staged for deletion. |
| Twilio and SMS send paths | None. Hits are the deny-list script and its tests, the manual SQL that drops `sms_*` tables, legacy `supabase/migrations/*`, the `smsSubscribe` i18n block (dead), and `0004_operations.sql` (encrypted operator WhatsApp contact, which is allowed: operators only). |
| Public alert text ("EVAKUASI", "Segera evakuasi") | None in code. "Peringatan Dini" appears only inside saved third-party fixtures (DSDA and BMKG pages). Dead i18n strings remain: "SMS peringatan langsung terkirim", "Rekomendasi evakuasi" (F9). `supabase/seed.sql:88` has a BMKG-attributed alert row (legacy, F14). |
| Writes to SCADA, pumps or gates | None. No Modbus or OPC-UA library and no setpoint or command code. Pump tables are state only (`pump_states`, append-only). |
| `LIVE` and "Real-time" labels in UI | None in rendered UI. Ringkasan shows empty states only. Leftovers: the orphaned `components/dashboard/InfrastructureStatusCard.tsx:227` (pulsing "Data Real-time" label), and many `real-time` and `live` strings in `src/i18n/{id,en}.ts` (F9, F10). |
| R2 and accuracy reporting | None. "R2" hits are Cloudflare R2 storage and a source id in `config/polder_candidates.yaml`. `metrics.py` and `training_results.json` are deleted. |
| GPL and AGPL in runtime deps | npm: `check-licenses.mjs` reports 0 denied. Flagged for review: LGPL sharp-libvips (dynamically linked, acceptable), Hippocratic-2.1 react-leaflet (Legal, L1), FSL `@sentry/cli` (build tool), and CC-BY caniuse-lite. Python runtime: `psycopg` is LGPL-3.0, used unmodified, which is acceptable. **pglast (GPL-3.0+)** is in `ml-service/requirements-dev.txt` only. It is imported only by `tests/store/test_migration_files.py` (via `importorskip`), and it is not in `requirements.txt`, the image or `src/`. Judgement against guardrail 13: **compliant**. It is a test-time tool that is never linked into or shipped with the core. It must still be recorded in `docs/LICENSES.md` (F12). |

`node scripts/check-guardrails.mjs` reports `guardrails: OK (no findings)`.

---

## 4. Test and tool results (run 2026-11-02, local Windows)

| Command | Result |
|---|---|
| `node_modules/.bin/tsc --noEmit -p .` | exit 0, no errors |
| `node_modules/.bin/vitest run` | 6 files, **64 passed** (deleted-routes 10, check-guardrails 9, sentry-scrub 5, smoke 1, utils 3, time 36) |
| `node scripts/check-guardrails.mjs` | `guardrails: OK (no findings)`, exit 0 |
| `node scripts/check-licenses.mjs` | `licenses: OK (660 packages, 26 runtime package(s) flagged for review, 0 denied)`, exit 0 |
| `python -m pytest -q -p no:warnings` (ml-service, scratchpad venv) | **286 passed, 1 skipped**. The skip is `tests/store/test_postgres_integration.py:24`: NOAH_TEST_DATABASE_URL not set |
| `python -m noah.store.stations` (validate) | 38 stations; thresholds by source: dsda_official 1, dsda_posko_banjir_page 24, unknown 13 |
| `npm run build` | not run, as instructed (the main session reports it green) |
| Postgres integration, migrations on PostGIS | **not run**: no DB and no Docker on this machine |

---

## 5. CI review (`.github/workflows/ci.yml`)

| Job | Would it run? | Notes |
|---|---|---|
| guardrails | Yes | Dependency-free, runs before `npm ci`. |
| secrets (gitleaks) | Runs, but **fails** until B-006 | The full-history scan is red by design while the JWT is in history. `gitleaks-action@v2` needs a `GITLEAKS_LICENSE` secret if the repo owner is an organization. The Docker gitleaks run on a bind-mounted repo can hit git "dubious ownership"; check this on the first run. |
| typecheck | Yes | Passes locally. |
| lint | Runs, but **does nothing** | eslint is not a devDependency, so the step prints a warning and passes. `npm run lint` (`eslint .`) fails locally. `.eslintrc.json` is legacy format, which ESLint 9 ignores (F7). |
| test-web (vitest) | Yes | |
| test-ml (pytest) | Yes | `working-directory: ml-service`, `pyproject.toml` sets `pythonpath = ["src"]`, and it installs `requirements.txt` plus `requirements-dev.txt`. Exit code 5 is tolerated. |
| db-migrations (PostGIS) | Should run; **unverified** | `postgis/postgis:16-3.4` with trust auth and a health check. With `working-directory: ml-service` and `PYTHONPATH=src`, the default paths resolve to repo-root `db/migrations` and `config/stations.yaml` (correct in a checkout). `NOAH_REQUIRE_DB=1` turns a skip into an error. The "none pending" grep matches the runner output. The S2 import reads the tracked `ml-service/data/tma_2020.xlsx.csv`. This is the only place the schema and append-only triggers would be proven. |
| build | Yes | Placeholder env. The bundle check covers OWM. |
| docker | Yes | `compose config` for prod, staging and edge, both image builds, and the non-root check. Nothing checks that the ML image can migrate or load stations (F3). |
| licenses | Yes | `check-licenses.mjs` reads `package-lock.json` before `npm ci`. `pip-licenses` runs on runtime requirements only, so pglast is not scanned. That is correct for guardrail 13, but it means F12 has to be handled by hand. |

The workflow has never executed: the branch is local and uncommitted.

---

## 6. Middleware gate (`middleware.ts`)

- **Fail-closed: PASS.** `isAuthorized` returns false when `NOAH_GATE_USER` is empty or `NOAH_GATE_PASSWORD` is shorter than 16 characters. The misconfiguration is logged once, without values.
- **Allowlist: PASS.** It allows the exact paths `/api/v1/health`, `/favicon.ico`, `/robots.txt` and `/sw.js`, plus the prefix `/_next/static/`. Paths containing `..`, `%2e`, `%2f`, `%5c`, `\` or `//` are never allowlisted, so they fall through to auth (fail-closed direction). `/_next/image` and `/_next/data` need credentials.
- **Uniform 401: PASS.** A single `deny()` returns the same body (`Unauthorized`) and headers (`WWW-Authenticate`, `no-store`, `X-Robots-Tag`) for every path. The response does not reveal whether a route exists.
- **Credential check: PASS.** HTTP Basic, decoded as UTF-8. User and password are compared through SHA-256 digests with a constant-time XOR loop. No secret is hardcoded.
- `matcher: '/:path*'` also matches `/`.
- **Tests: none.** No file references `middleware`, `isAuthorized`, `isAllowlisted` or `NOAH_GATE_*` (F6). B-010's "(tested)" clause is not met.
- Note: Next 16 deprecates `middleware.ts` in favour of `proxy.ts` (F18).

---

## 7. Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| F1 | **High** | Connectors cannot record to the store in a deployment. `python -m noah.connectors run` needs `NOAH_SINK=module:callable`, but no factory exists: `PostgresSink(conn, objects)` has no from-env constructor. `docker-compose.yml` has no worker service, and `docs/ops/vps-layout.md:21` defers workers to W2, which contradicts W1 acceptance. | Add `noah.store.postgres:sink_from_env` (connects with `NOAH_DATABASE_URL` and uses `object_store_from_env()`), with a test. Add a `worker` compose service running `python -m noah.connectors run` with a volume or S3 for objects. |
| F2 | **High** | The API's health is never wired. `create_app()` defaults to `health_source=None`, and the Dockerfile CMD uses that factory, so `/api/v1/health` always answers 503 "Health source not configured". The freshness in A5 cannot be shown. | Add `create_app_from_env()`, which builds a `PostgresHealthSource` (a connection per request or a small pool), use it in the CMD, and test it. |
| F3 | **High** | `ml-service/Dockerfile` (build context `ml-service/`) copies only `src/`. `db/migrations/` and `config/stations.yaml` live at the repo root, and the default paths (`Path(__file__).parents[4]`) resolve to `/db/migrations` and `/config/stations.yaml` in the container. As a result, `noah.store.migrate` and `noah.store.stations --apply` fail inside the image. | Build from the repo root (`context: .`, `dockerfile: ml-service/Dockerfile`, with a matching `.dockerignore`), `COPY db/migrations` and `config/stations.yaml`, set `NOAH_MIGRATIONS_DIR` and `NOAH_STATIONS_CONFIG`, and add a CI step that runs `python -m noah.store.stations` inside the image. |
| F4 | Medium | `ml-api` sits only on `internal: true` (no egress), but Postgres is managed and external. Once F2 is fixed, the API cannot reach the DB, and a worker on the same network cannot reach the sources. | Put the API and worker on an egress-capable network, restricted where possible, and document it in `docs/ops/vps-layout.md`. |
| F5 | Medium | The web HEALTHCHECK accepts only 200 or 501 from `/api/v1/health`. Compose sets `ML_API_URL`, so the route proxies to the ML API, which returns 503 (because of F2, and whenever any connector is stale). The web container is therefore permanently unhealthy, and the check mixes liveness with data freshness. Comments in both Dockerfiles still say "501 until B-040". | Add a separate liveness probe (an allowlisted `/api/v1/livez`, or a TCP check). Keep `/api/v1/health` for the uptime monitor and fix the comments. |
| F6 | Medium | `middleware.ts` has no tests, and B-010 requires refusals to be tested. | Add `tests/platform/middleware.test.ts`: env unset, short password, wrong and right credentials, each allowlisted path, traversal variants, and the same 401 body and headers for an existing and a missing route. |
| F7 | Medium | The lint job is a no-op: eslint is not installed, `npm run lint` fails, and `.eslintrc.json` is ignored by ESLint 9. B-015's ESLint clause is covered only by `check-guardrails.mjs`. | Add `eslint@9` and `eslint-config-next` with `eslint.config.mjs` (flat config) and make the job fail on errors, or remove the lint script and job and record that the guardrails job covers the ban. |
| F8 | Medium | CI has never run for W1. The full-history gitleaks step will stay red until the history rewrite (B-006), and the PostGIS job is unproven. | Commit and push to a PR so CI runs once. Keep the gitleaks failure; it turns green only after rotation and the rewrite. |
| F9 | Medium | `src/i18n/{id,en}.ts` still contain misleading strings: "LSTM (50%) + Curah Hujan (30%) + CCTV (20%)", "historical replay ... live", "Real-time" (about 15), "SMS peringatan langsung terkirim", and evacuation and chatbot texts. They are not rendered by current pages (43 keys used), but B-023's grep check fails and any future reuse would break guardrails 1 and 5. | Remove the unused keys. |
| F10 | Low | Orphaned legacy components remain: `components/dashboard/InfrastructureStatusCard.tsx` (pulsing "Data Real-time" label, Siaga status taken from strings), `DashboardStats.tsx`, `components/map/TimelineScrubber.tsx` (`toLocaleTimeString` without `timeZone`), `RadarLayer.tsx` (RainViewer) and `MapPicker.tsx`. | Delete them, or rewire them with provenance when needed. |
| F11 | Low | `app/api/disaster-proxy/route.ts` is the old PetaBencana proxy. It still has the G-039 timeframe fallback (anything other than 24h or 3d becomes 24 h), echoes upstream error text and the URL, and has no caller. `app/api/preferences` reads `user_preferences`, which B-032 drops. Both are behind the gate. | Delete both, or make them return 410. |
| F12 | Low | `docs/LICENSES.md` Python section is stale. It lists only fastapi, uvicorn and pydantic, and is missing httpx (BSD-3), psycopg (LGPL-3.0), PyYAML (MIT) and dev-only pglast (GPL-3.0+). Guardrail 13 requires a record of every dependency. | Update it, and add a guard (test or guardrail rule) that `ml-service/src` never imports `pglast`. |
| F13 | Low | `ml-service/data/tma_2020.xlsx.csv` (and `hujan_bogor2022.csv`) are still tracked. B-041 says to move them to `raw/s2_opendata/` and remove them from git. | Do this after the object store is chosen. Keep the existing sample fixture, and point the CI import at the bucket or the fixture. |
| F14 | Low | Legacy `supabase/migrations/*` and `supabase/seed.sql` (BMKG-attributed alert rows, mock evacuation data) remain until B-032. | Delete them with B-032, after Ari approves. |
| F15 | Low | `files/`, `files.zip` and `KICKOFF_PROMPT.md` are untracked and not ignored (they duplicate the plan bundle), so `git add -A` would commit them. `Untitled-1.txt` and `Untitled-2.txt` still exist locally (ignored). | Add `files/` and `files.zip` to `.gitignore`, or delete them. Delete the Untitled files. |
| F16 | Low | B-027 is incomplete: `typescript` and `tailwindcss` are still in `dependencies`, ranges are unpinned, and `latest` is used for `@testing-library/jest-dom` and `jsdom`. | Move them to devDependencies and pin the versions. |
| F17 | Low | Remaining gaps: no validated env schema (B-005); no Python `sentry-sdk` or cron monitors (B-028); no alert to an admin channel on stale data and no uptime monitor (B-040); no lint for bare `getHours` or `toLocale*` (B-029); no Python lockfile (B-030); `boto3` absent for the S3 backend. | Schedule these as W1 follow-ups. |
| F18 | Info | Next 16 deprecates `middleware.ts` in favour of `proxy.ts`. The build is green. | Rename it when convenient, and keep the tests from F6. |
| F19 | Info | S4 and the S5 image connector are disabled until their endpoints are confirmed. The S4 parser has been tested only on a constructed fixture. S15 `flood_depth` is not yet confirmed against a real flood report. | External confirmations: BPBD Q1, BMKG Q5, PetaBencana Q6. |
| F20 | Info | B-001 asked to delete `scripts/seed-regions.mjs`. It was kept and now reads env only, failing closed. That is acceptable, but the script is out of scope. | Delete it with B-032. |

---

## 8. Overall verdict

**W1 is not yet code-complete.** The cleanup half is done in the working tree: secrets out of code, fake data, public alerts, PII intake, SSRF and LLM proxies, and out-of-scope layers are all gone, and guardrails, tests, typecheck and licences pass. The data half is code-complete at the library level: schema, migration runner, connector framework, S1, S5-CAP and S15 parsers, object store, station config, health computation and S2 importer, with 286 tests. What is missing is the wiring that makes "connectors running and recording; health shows freshness" possible at all: F1 (sink factory and worker), F2 (health source), F3 (migrations and config in the image) and F4 (DB egress). These are agent work, not human steps. F5 to F9 should land in the same pass.

**What blocks "W1 done" after the code gaps are fixed:**
1. Ari rotates or revokes the Supabase, Roboflow, OWM and Gemini keys (B-001, B-002, B-003, B-027) and reviews the Supabase logs.
2. Ari approves the history rewrite and force-push (B-006). The CI gitleaks job stays red until then.
3. Commit, push and a first green CI run, including the PostGIS migrations job; then Ari sets branch protection (B-025).
4. Ari chooses the managed Postgres and object storage, then the VPS (B-030, B-031, B-033). Then: migrations applied, stations loaded, connectors running, and health showing freshness on staging (B-040: stop a connector and see an alert within 20 min).
5. External endpoint confirmations for S4 (BPBD) and S5 images (BMKG), and DSDA confirmation of the 24 page-sourced thresholds and the 13 unknown ones (B-034, B-036 to B-038).
6. Ari runs the live Supabase SQL and makes the decisions it needs: B-011, B-013 (with Legal), and B-032. Ari also decides on the Vercel and domain question (B-009) and sends the data requests (B-043).
7. DSDA input on the scorecard (c8) and the lighthouse choice (B-042, needed for W2).
