# 09. Roadmap and acceptance criteria

Weeks are counted from the day Phase B starts (W1). The proposal maps them to SCCIC workpackages: W1 to W2 = WP02 Assessment and site readiness, W3 = WP03 Pilot, W4 to W9 = WP04 AI modules and integration. Target end: first week of December 2026.

| Week | Goal | Must be true at the end (acceptance) | Lead agents |
|---|---|---|---|
| W0 (Phase A) | Audit | `docs/audit/GAP_REPORT.md` and `BACKLOG.md` approved by the human | all, qa-verifier |
| W1 | Clean foundation and data flowing | Leaked keys rotated and removed (D10, D11). All fake data paths removed or flagged (D1 to D7). CI runs tests. Target schema migrated. Connectors S1, S4, S5 (images), S15 running and recording to the store; health endpoint shows freshness. Station config with official Siaga thresholds. Readiness scorecard computed for candidate polders | platform-security, data-ingestion, backend |
| W2 | M1 live; geo layer | Event definition v1 stored. DSDA Siaga and baseline logged as forecasts. Scoreboard API and page working on live data. DEM S9 ingested, subsidence-corrected, depressions and HAND per kelurahan and polder stored. Lighthouse polders chosen and their boundaries loaded | evaluation, hydro-ml, operator-ui |
| W3 | Pilot in shadow mode | M2 baseline and pump-aware adjustment live for lighthouse polders. M3 in simulator mode. Recommendations delivered to the operator WhatsApp group and dashboard with acknowledge flow. Roles and login enforced. Operator one-page guide written in Bahasa Indonesia | hydro-ml, backend, operator-ui |
| W4 to W6 | Integrate granted data, iterate | Every newly granted source (S3, S6, S7, S8, S12) integrated within 5 working days of access. Weekly report generated automatically every Monday. Operator feedback captured weekly and turned into backlog items | data-ingestion, evaluation, all |
| W7 to W8 | Models compete | ML model and baseline compared on held-out data; winner selected by M1 rules. M3 calibrated on SCADA for at least one polder if logs exist. Additional polders added if data supports | hydro-ml, evaluation |
| W9 | Report and handover | Final evaluation report (per source, polder, lead time). Lists of available data, closed data, and blind spots. Runbook, architecture doc, and operator guide complete. System keeps running for the rest of the wet season | all, qa-verifier |

## Definition of done for any task
- Code merged with tests that CI runs.
- No guardrail violated (`10_GUARDRAILS.md`).
- Every new data shown in UI traceable to source and timestamp.
- Docs updated where behavior changed.
