# QA verification: Phase A (W0 audit)

Verifier: `qa-verifier`. Date: 2026-11-02. Tree: `main` at `49a23e3` plus the untracked `docs/`.
Inputs: `docs/audit/GAP_REPORT.md` (G-001 to G-138), `docs/audit/BACKLOG.md` (B-001 to B-099), the seven source audits in `docs/audit/`, `docs/plan/01`, `09`, `10`, `11`, and `CLAUDE.md`.
Method: Python scripts parsed every table row and backlog item, checked each cited path against the working tree, printed the cited lines (with long tokens redacted) and cross-referenced G-/B- IDs. The scripts ran in the session scratchpad and are not committed. This file reproduces no secret values.

## Overall verdict

**CONDITIONAL PASS.** Nothing blocks approval. Two checks fail on small documentation gaps (F1 to F3). Fix those, then the human can approve W0. Items F4 to F8 are optional corrections for accuracy.

| # | Check | Result |
|---|---|---|
| 1 | Cited paths exist; `file:line` claims match | **PASS** (2 small line drifts: F5) |
| 2 | Every GAP row cites a plan section | **FAIL**: 4 rows (F1) |
| 3 | Every guardrail violation maps to a W1 item | **FAIL**: 1 row (F2) |
| 4 | Backlog vs guardrails and non-goals; W1 order; refs; Done when and Refs | **PASS** (1 item has no G- ref: F3) |
| 5 | Secrets hygiene | **PASS** |
| 6 | Internal consistency of counts | **PASS** |
| 7 | Advisory review of decisions | 6 advisory notes (A1 to A6) |

---

## Check 1: paths and line claims. PASS

**Path existence.** The script pulled 292 distinct path-like tokens out of the Current state, Target and Notes columns, after expanding `{a,b}` braces and globs.
- 281 references resolve directly in the tree.
- 71 bare basenames (for example `FloodMap.tsx`, `main.py`, `seed.sql`, `BottomTile.tsx`) each resolve to exactly one repo file (for example `components/map/FloodMap.tsx` or `ml-service/src/main.py`).
- The rest are not file paths, and none is a broken citation:
  - npm package names (all in `package.json` or `package-lock.json`; `@mapbox/polyline` is a transitive dependency);
  - strings (`Asia/Jakarta`), URLs, an MQTT topic, table names, ESLint presets;
  - proposed targets (`docs/LICENSES.md`, `docs/archive/hackathon/`, `demo/`, `research/`);
  - shorthand (`Header/Sidebar/Footer/SplashScreen.tsx`, which are four files in `components/layout/`).

**Line content.** The cited lines were printed for 77 rows. Each was judged against its claim, and about 15 sub-citations were checked by hand.

Rows that match (minor drift allowed): G-001, G-002, G-004, G-007, G-008 (`:54`, `:157`), G-009 (`:29`, `:99`, `:120-139`), G-010 (`20250309100000_create_sms_subscribers.sql:48-49,59-61`, anon SELECT `USING (true)`), G-011, G-012, G-013, G-014, G-015, G-016, G-017, G-018, G-019, G-020, G-021, G-022, G-023, G-024, G-025, G-026, G-027, G-028, G-029, G-030, G-032, G-033, G-034, G-035, G-036, G-037 (`:46-53` replay index, `:74`, `:92` `new Date()`), G-038, G-039, G-040, G-041, G-046, G-047, G-048, G-049, G-051, G-053, G-057 (`TEXT[]` at `:10` receives `::jsonb`; the extension is created only in `seed.sql:4`), G-058 (`seed.sql:65` TRUNCATE, `:75-91` alerts, `:88` "Peringatan dini dari BMKG"), G-059, G-062, G-066, G-068, G-069, G-071, G-072, G-073 (`:111` body secret), G-074, G-075, G-076, G-077, G-078 (`:19` r2, `:31-32` recall and accuracy), G-079, G-092, G-095, G-096, G-098, G-105, G-111, G-112, G-113, G-115 (`app/layout.tsx:49` `lang="en"`), G-116, G-118, G-119, G-122, G-123, G-124, G-131, G-136.

- **G-003:** `app/api/chatbot/route.ts:38` is blank today. That fits the claim that the literal was removed in `0ea2529` and survives only in history.
- **F5 (drift, not wrong):** two rows cite the wrong lines (details in Fixes).

**Repository facts.** 381 tracked files and 46 commits, as stated. The five CSV/JSON files in `ml-service/data/` are tracked.

**"Not found" claims for NEW rows.** A sample of 15 was checked. Each named file or pattern is absent from the code (searched outside `node_modules`, `docs/`, `.claude/` and `files/`):
- files: `middleware.ts`, `proxy.ts`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `conftest.py`, `app/api/pump-status/`;
- patterns: `NOAH_DEMO_MODE`, `Asia/Jakarta`, `postgis`, `CREATE TABLE … observations`, `CREATE TABLE … forecasts`, `verifications`, `pump_states`, `pytest`, `keycloak`, `mqtt`.

The only hit for "readiness" is a UI pump-readiness percentage in `BottomTile.tsx:449`. It is not a polder scorecard, so G-056 "not found" stands.

**Merge completeness.** All 347 source rows (RA 77, DI 62, ML 35, EV 28, BE 53, UI 62, PS 30) are cited in some `src:` list except BE-026 and BE-027. Their content (`/api/analysis`, `/api/flood-analysis`) is covered by G-019, but the IDs are missing (F6).

## Check 2: plan section per row. FAIL (4 rows)

134 of 138 rows cite a `docs/plan` file in the Target column. Spot checks found the cited sections in the plan: `03` Notifier and ISSP compatibility, `06` steps 1 to 5, `07` "Before SCADA access", `08` pages 1 to 6, `04` S1 to S17, `05` Event definition v1.

These rows cite no plan section:

| Row | Target column | Suggested fix |
|---|---|---|
| G-120 | "all pages" | `08` UI pages per role; `10` #14 |
| G-133 | "none" | `00` (plan is the source of truth) or `09` Definition of done |
| G-134 | "none" | `10` #3 (the row is tagged **G3**) and #10 |
| G-135 | "none" | `09` W0 (the audit is approved by the human) |

## Check 3: guardrail violations to W1 items. FAIL (1 row)

The guardrail-violation table lists 18 G# lines and 73 row references. Every B- item named in the table is a W1 item.

Each G- row in the table was checked for at least one W1 item whose `Refs:` cite it. All pass except one:
- **G-116 (G15, i18n).** The table maps it to B-009, but B-009's Refs do not include G-116. The only item that cites G-116 is B-053, which is in **W2**. B-009 does set SSR `lang="id"`, so part of the fix is already in W1 (F2).

Two smaller findings:
- **Table inaccuracy (F4).** The G#5 line lists G-058 but does not list B-032, the W1 item that covers it. B-032 appears only on the G#1 and G#6 lines.
- **Other guardrail-tagged rows.** Rows tagged **G#** that have no W1 item are all NEW target features (G-051, G-081 to G-083, G-090, G-091, G-096, G-099, G-100, G-122, G-129), and G-045 (PARK). The NEW rows are not violations. G-045 is listed under "Parked rows" in BACKLOG; see A5.

## Check 4: backlog vs guardrails and non-goals. PASS

**Structure.**
- 99 items, B-001 to B-099, with no gaps or duplicates.
- Each item's week tag matches its section.
- Every item has `Done when:` and `Refs:`, and every Refs line cites a `docs/plan` file.
- Every cited G- ID exists.
- Only **B-086** cites no G- row (F3).
- G rows with no item: G-045, G-135 (both PARK, listed under Parked rows) and G-118, G-120 (KEEP). That is acceptable.

**W1 order.** W1 opens with the guardrail fixes the template requires:
- secrets: B-001 to B-006;
- public alert paths: B-007 to B-009;
- access gate: B-010;
- PII: B-011 to B-013;
- fake data: B-014 to B-022.

Foundation work (CI, schema, connectors) comes after these. Every W1 acceptance line in `09` has a W1 item: keys B-001 to B-003, fake data B-014 to B-022, CI B-024 and B-025, schema B-031, connectors S1, S4, S5 and S15 as B-036 to B-039, health B-040, Siaga config B-034, scorecard B-042.

**No contradiction found.**
- **Public alerts:** only removals. B-070 sends WhatsApp to authenticated operators only, throttled one message per polder per 30 min. B-088 MQTT is outputs-only, off by default, and per `03` ISSP compatibility.
- **SCADA:** B-080 is a read-only connector with the CI deny-list kept green (B-015). B-093 only calibrates. No item writes to SCADA, pumps or gates.
- **National coverage:** B-020 removes the province selector. B-095 says "DKI polders only; no national coverage".
- **Deep-learning nowcast:** B-094 uses pySTEPS (BSD-3, extrapolation, not DL), is blocked on BMKG data, and says "No deep-learning nowcast built from scratch", in line with `06` step 5.
- **Paid services:** B-027 retires the unbudgeted ones. B-070 says "Ask before any paid service". B-018 and B-025 remove AGPL code and block GPL in core.
- **Destructive steps:** B-006 (history rewrite and force-push) and B-013 (PDP purge) are marked **Needs approval**. B-011 is a human step on the live DB.

## Check 5: secrets hygiene. PASS

Scanned files: GAP_REPORT, BACKLOG and the seven source audits.

Patterns searched:
- JWT `eyJ` followed by 5 or more characters, `sk-`, `AIza`, Twilio `AC`/`SK` plus 20 or more hex;
- hex longer than 24 characters, and mixed-case base64 with digits longer than 24 characters;
- `password=`, `secret=`, `token=`;
- Postgres URLs with credentials;
- phone numbers and emails.

The live literals in the repo (the service_role JWT, the Roboflow fallback, the Search Console token, and the values in `.env.local`) were loaded in memory only. Any 8 or 12-character fragment of them was searched for in the audit files.

- **No leaked value.**
- All hits are false positives:
  - long `docs/plan/...` paths;
  - `UPSTASH_*` variable *names* (`platform-security-engineer.md:47`, `repo-auditor.md:36`);
  - the scan-method text `token=` (`platform-security-engineer.md:25`);
  - migration timestamps that look like phone numbers.
- Masked prefixes present, all within the 4-character limit:
  - `platform-security-engineer.md:19`: a 4-character JWT prefix;
  - `platform-security-engineer.md:20`: a 4-character prefix of the 20-character Roboflow key.
- The Postgres dev password from `.env.example` is not reproduced (`platform-security-engineer.md:22` names the user only).
- No Supabase project host and no PII appears in any audit file.

## Check 6: internal consistency. PASS

- **Decision counts.** Summary table: KEEP 5, REFACTOR 19, REBUILD 14, NEW 50, DELETE 43, PARK 7, total 138. Parsed table: identical. G-075 contains an escaped `\|` that a naive split misreads; with it handled, the counts match.
- **Per-agent source rows.** 347 in total, matching the source files exactly.
- **Backlog counts.** The header states W1 43, W2 19, W3 16, W4 to W6 11, W7 to W8 6, W9 4 (99 in total). The parsed items give the same numbers.
- **Cosmetic.** Item tags use `W4-W6` and `W7-W8`, while the section headings say "W4 to W6" and "W7 to W8".

## Fixes needed (for the GAP_REPORT and BACKLOG owners)

| ID | File | Row/item | Fix | Blocking |
|---|---|---|---|---|
| F1 | GAP_REPORT | G-120, G-133, G-134, G-135 | Add a plan section to the Target column (suggestions in Check 2) | Yes |
| F2 | GAP_REPORT / BACKLOG | G-116 | Either add G-116 to B-009 Refs (it already sets SSR `lang="id"`) and note that the dictionary work stays in B-053 (W2), or drop G-116 from the G#15 violation line | Yes |
| F3 | BACKLOG | B-086 | Add a G- ref (for example G-083 or G-138), or write "Refs: no gap row" explicitly | Yes (template) |
| F4 | GAP_REPORT | G#5 violation line | Add B-032 to the W1 item list (it covers G-058) | No |
| F5 | GAP_REPORT | G-110, G-109 | G-110: `next.config.js:39-46` should be `:44-52` (Sentry plugin options and `withSentryConfig`). G-109: the stale image host is at `next.config.js:37`, not `:30-35` | No |
| F6 | GAP_REPORT | G-019 | Add BE-026 and BE-027 to the `src:` list | No |

## Advisory notes (decisions worth a second look; not failures)

- **A1, G-118 KEEP basemaps.** It keeps Carto dark and Esri imagery and topo. `10` #14 names OpenStreetMap/MapLibre as the free map tier, and the commercial terms of Esri and Carto are uncertain for a government deployment. Suggest REFACTOR: OSM as the default, with Esri and Carto off until DSDA Q8 and Legal Q3 are answered.
- **A2, qa-verifier as owner of build work.** G-112 and B-024 (tests), B-023 and G-136/137 (doc edits), B-078 and G-138 (operator guide), and B-086 are owned by `qa-verifier`. Its role says "You do not write features. You verify." When the verifier writes the tests it later checks, independence is lost. Suggest platform-security-engineer or the module owners for B-024, and operator-ui-engineer for B-078. qa-verifier then reviews.
- **A3, G-100 / B-088 partner webhooks.** "Signed opt-in webhooks for authenticated partners" goes beyond the MQTT topics in `03`. Under `10` #1, outputs go only to authenticated operators, so confirm with SCCIC and DSDA that partner systems count as operator channels before W4.
- **A4, G-020 DELETE `/api/cctv-scan`.** This is right for now. Make sure G-054/B-083 (S12 via VIANA) does not reintroduce a server-side fetch of caller-supplied URLs; it should use an allowlisted camera registry only (B-083 already says "allowlisted").
- **A5, G-045 PARK `hujan_bogor2022.csv`.** The Notes say "move to object storage", but no item removes it from git, unlike `tma_2020` (B-041) and `DATASET_FINAL_TRAINING` (B-016). Suggest adding it to B-041 or B-016 so the W1 git cleanup is complete.
- **A6, plan timing.** `06` step 2 says the baseline "ships Week 3", while `09` W2 requires "baseline logged as forecasts". GAP_REPORT section 6 already raises this as a plan amendment (W2 interim baseline). Ari should decide it before W2 starts.

## Resolution (applied by the main session after this review)
- F1: plan sections added to G-120, G-133, G-134, G-135.
- F2: B-009 Refs now include G-116 (SSR `lang` part; full i18n stays in B-053).
- F3: B-086 states it has no G- row (process item).
- F4: Guardrail 5 violation line now lists B-032.
- F5: G-109 and ND-33 cite `next.config.js:37`; G-110 cites `next.config.js:44-52`.
- F6: no change; G-019 already cites "BE-025 to BE-028", which includes BE-026 and BE-027.
- A2: build ownership moved off qa-verifier: B-023, B-086, G-136 to evaluation-engineer; B-024, B-098, G-112, G-137, G-135 to platform-security-engineer; B-078 to operator-ui-engineer; G-138 to operator-ui-engineer and platform-security-engineer.
- A1, A3, A4, A5, A6: left open for the human (see summary).
