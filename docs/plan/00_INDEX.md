# Noah AI build plan: index

This folder is the single source of truth for what Noah AI must become between now and December 2026, written so that Claude Code and its subagents can compare it with the existing repository and decide what to keep, refactor, rebuild, create, or delete.

## Read in this order
| File | Purpose | Main readers |
|---|---|---|
| `01_PRODUCT_BRIEF.md` | What Noah is now, who uses it, scope and non-goals | All agents |
| `02_CURRENT_STATE_AND_AUDIT.md` | What the repo is known to contain, known defects with file paths, audit checklist | repo-auditor, all |
| `03_TARGET_ARCHITECTURE.md` | Target system: layers, components, data model, APIs, operator workflow, ISSP compatibility | backend, data, UI |
| `04_DATA_SOURCES.md` | Every data source, owner, access status, minimum spec, fallback | data-ingestion |
| `05_MODULE_1_EVALUATION.md` | Open evaluation: forecast logging, event matching, POD/FAR/CSI/lead time | evaluation |
| `06_MODULE_2_IMPACT_NOWCAST.md` | Impact nowcast per polder and kelurahan, 1 to 3 h, and recommendations | hydro-ml |
| `07_MODULE_3_POLDER_OPS.md` | Polder water balance, time to full, pre-emptive drawdown, pump anomaly | hydro-ml, backend |
| `08_ROLES_AND_ACCESS.md` | User roles, permissions, what each role sees | backend, UI |
| `09_ROADMAP_AND_ACCEPTANCE.md` | Week-by-week plan with acceptance criteria | all |
| `10_GUARDRAILS.md` | Legal, safety, data, licensing, and engineering rules | all, platform-security, qa |
| `11_GAP_ANALYSIS_TEMPLATE.md` | Output format for the audit and backlog | repo-auditor, qa |

## Decision vocabulary used in the audit
- **KEEP**: works and fits the target; leave as is.
- **REFACTOR**: fits the target but needs changes (naming, structure, tests, removing fakes).
- **REBUILD**: the capability is needed but the current implementation is wrong; replace it.
- **NEW**: needed capability that does not exist yet.
- **DELETE**: not needed in the target, or violates a guardrail.
- **PARK**: not needed for December but worth keeping behind a flag for later.

## Background documents (outside this repo)
- Proposal: "Proposal Noah AI: Sistem Pendukung Keputusan Operasional Pengendalian Banjir DKI Jakarta" (Claude Doc). Chapters 5 to 8 are the source for modules, data, and the work plan.
- Budget: Google Sheet "RAB Noah AI Oktober sampai Desember 2026". Infrastructure choices in this plan must stay within it (one production VPS, managed PostgreSQL/PostGIS, object storage, about 60 GPU hours, Anthropic API about USD 20 per month).
