# CLAUDE.md: Noah AI

## What this repository is becoming
Noah AI is being rebuilt from a hackathon flood app for the public into a **decision-support module for flood-control operators** in DKI Jakarta: Dinas Sumber Daya Air (DSDA), its pump-house operators, and BPBD DKI. It forecasts which polders and kelurahan will flood in the next 1 to 3 hours, recommends where pumps and crews should go, and records every forecast against what actually happened so accuracy is always visible.

Full plan: `docs/plan/00_INDEX.md`. Read it before any non-trivial change.

## Non-negotiable rules (details in `docs/plan/10_GUARDRAILS.md`)
1. **No public warnings.** Under UU 31/2009 only BMKG issues meteorological warnings and BPBD issues disaster warnings. Noah sends recommendations to operators only. No SMS or push to residents.
2. **No writes to SCADA, pumps, or gates.** Noah recommends; humans act.
3. **No fake data in production paths.** No `Math.random()`, no canned "demo" responses, no replayed CSVs presented as live. Demo or synthetic data must be behind an explicit flag and visibly labeled in the UI.
4. **Forecasts and observations are append-only.** Never update or delete a stored forecast. Evaluation depends on it.
5. **Secrets only via environment variables.** Never commit keys. Leaked keys are rotated, not just removed.
6. **Every number a user sees must trace to a source** (station, model version, timestamp).

## Working conventions
- Store time in UTC, display in Asia/Jakarta (WIB).
- Water level in cm relative to the station datum; rainfall in mm; discharge in m3/s.
- UI language: Bahasa Indonesia first; English secondary.
- Each module has its own spec under `docs/plan/0[5-7]_*.md`; acceptance criteria live in `docs/plan/09_ROADMAP_AND_ACCEPTANCE.md`.
- Prefer integrating with SCCIC ITB's ISSP platform conventions (OpenAPI, OIDC/Keycloak SSO, MQTT topics) over building generic platform features. See `docs/plan/03_TARGET_ARCHITECTURE.md`.
- Subagents live in `.claude/agents/`. Use them for parallel analysis and for work inside their domain.
