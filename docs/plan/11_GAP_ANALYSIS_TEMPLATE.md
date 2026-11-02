# 11. Gap analysis and backlog templates

## `docs/audit/GAP_REPORT.md`

### Summary
- Repository size, stack, services found.
- Counts of KEEP / REFACTOR / REBUILD / NEW / DELETE / PARK.
- Top 10 decisions with one-line reasons.
- Guardrail violations found (must all appear in the backlog as W1 items).
- Open questions for the human (with who can answer: Ari, DSDA, BPBD, BMKG, SCCIC).

### Inventory and decisions
| ID | Area | Current state (file paths, evidence) | Target (plan file and section) | Decision | Effort (S/M/L) | Owner agent | Depends on | Notes and risks |
|---|---|---|---|---|---|---|---|---|
| G-001 | Water level ingestion | `app/api/water-level/route.ts` replays 2020 CSV (lines x to y) | `04_DATA_SOURCES.md` S1; `03` connectors | REBUILD | M | data-ingestion-engineer | DB schema | Polite scraping; permission requested |

Rules:
- Every row cites at least one real path or states "not found" for NEW items.
- Every decision cites a plan section.
- Mark any row touching a guardrail with the guardrail number.

### Reuse map
Which existing components carry over into which target component (for example: Leaflet map components to Ringkasan page; FastAPI service skeleton to API; Sentry setup kept).

## `docs/audit/BACKLOG.md`
Grouped by roadmap week. Each item:
```
- [ ] B-012 (W1, data-ingestion-engineer, M) Connector for Posko Banjir DSDA (S1)
      Done when: rows arrive every 5 min in `observations` for all posts; raw payload stored; health shows freshness; tests for parser with saved fixtures.
      Refs: G-001, 04_DATA_SOURCES.md S1, 10_GUARDRAILS.md #4 #6 #8
```
Order inside a week by dependency. W1 must start with guardrail fixes (secrets, fake data, public alerts).
