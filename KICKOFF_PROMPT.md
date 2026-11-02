# Kickoff prompt for Claude Code

Paste this into Claude Code from the repository root after copying `CLAUDE.md`, `docs/plan/`, and `.claude/agents/` into the repo.

---

Read `CLAUDE.md` and every file in `docs/plan/` in numeric order before doing anything else.

This session is **Phase A: audit and gap analysis only**. Do not modify application code yet.

1. Run these subagents in parallel, each read-only, each writing its findings to `docs/audit/<agent-name>.md`:
   - `repo-auditor`: inventory of the whole repository against `docs/plan/02_CURRENT_STATE_AND_AUDIT.md`.
   - `data-ingestion-engineer`: what data sources, fetchers, schemas, and seeds exist versus `docs/plan/04_DATA_SOURCES.md` and the data model in `docs/plan/03_TARGET_ARCHITECTURE.md`.
   - `hydro-ml-engineer`: the ML service and forecasting code versus `docs/plan/06_MODULE_2_IMPACT_NOWCAST.md` and `docs/plan/07_MODULE_3_POLDER_OPS.md`.
   - `evaluation-engineer`: anything resembling logging, metrics, or evaluation versus `docs/plan/05_MODULE_1_EVALUATION.md`.
   - `backend-api-engineer`: API routes, database access, auth, and integration points versus `docs/plan/03_TARGET_ARCHITECTURE.md` and `docs/plan/08_ROLES_AND_ACCESS.md`.
   - `operator-ui-engineer`: pages, components, and user flows versus the operator workflow in `docs/plan/03_TARGET_ARCHITECTURE.md` and the roles in `docs/plan/08_ROLES_AND_ACCESS.md`.
   - `platform-security-engineer`: secrets, CI, Docker, monitoring, and every guardrail in `docs/plan/10_GUARDRAILS.md`.
2. When all subagents finish, merge their findings into two files using the template in `docs/plan/11_GAP_ANALYSIS_TEMPLATE.md`:
   - `docs/audit/GAP_REPORT.md`
   - `docs/audit/BACKLOG.md`
3. Ask `qa-verifier` to check both files: every row must cite real file paths, every decision must reference a plan section, and nothing in the backlog may violate `docs/plan/10_GUARDRAILS.md`.
4. Stop and show me a summary: the top 10 decisions, anything marked DELETE, anything you are unsure about, and the open questions for the human. Wait for my approval before Phase B.

Phase B (implementation) starts only after I approve the backlog. Then follow `docs/plan/09_ROADMAP_AND_ACCEPTANCE.md` week by week.
