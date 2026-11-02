# 10. Guardrails

Any change that breaks one of these is rejected regardless of other merits. `qa-verifier` checks them on every phase.

## Legal and institutional
1. **No public warnings.** UU 31/2009: meteorological information and early warnings are BMKG's authority; non-BMKG stations may not publish their observations directly to the public. Disaster warnings are BPBD's role (UU 24/2007). Noah outputs go only to authenticated operators. Remove or disable any public alert, citizen SMS, or public push.
2. **No control of infrastructure.** No code path may write setpoints or commands to SCADA, pumps, or gates.
3. **Personal data (UU PDP).** No citizen personal data. Operator phone numbers encrypted, access limited to admin. Flood reports used at RT level, not individuals.
4. **Data use per agreement.** Data received under a PKS is used only for the purposes in the agreement; raw DSDA data is not redistributed. Public scraping of S1 is polite and documented.

## Data integrity
5. **No fake data in production.** Ban `Math.random()`, canned responses, and replayed historical data presented as current. Synthetic or demo data only behind `NOAH_DEMO_MODE=true`, visibly labeled ("DEMO" or "SIMULASI"), and excluded from M1.
6. **Append-only facts.** Observations, forecasts, verifications, pump states, and flood reports are never updated or deleted; corrections are new rows.
7. **Provenance.** Every value carries source, station or model version, and timestamp. UI shows "data terakhir" times and greys out stale data.
8. **Units and time.** UTC in storage, WIB in display; cm, mm, m3/s; conversions only at the edges.
9. **Honest metrics.** Report POD, FAR, CSI, Brier, lead time. Do not report accuracy or R2 for flood events. Report baseline next to every model.

## Engineering
10. **Secrets in environment only.** Pre-commit secret scanning; CI fails on detected secrets. Rotate anything ever committed.
11. **Tests run in CI.** Each module has unit tests; matching logic and water balance have property or table tests.
12. **Observability.** Sentry for errors; an alert if any connector is stale over 15 minutes or any scheduled job fails twice.
13. **Licensing.** Core code under a license compatible with government use. GPL code (for example GNN-UDS, MARL-UDS) only in a separate research service, never linked into the core. Record licenses of all dependencies.
14. **Budget.** One production VPS with a staging stack as containers, one managed Postgres/PostGIS, object storage, about 60 GPU hours, Anthropic API about USD 20 per month. Free tiers for maps (OpenStreetMap/MapLibre), weather fallback (Open-Meteo), error tracking, uptime, and repository hosting. Ask before adding any paid service.

## Product
15. Bahasa Indonesia first in all operator-facing text.
16. Recommendations are advice; the UI wording must make clear the operator decides.
17. Rate-limit operator messages (one per polder per 30 minutes unless category changes).
