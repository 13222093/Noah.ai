# Noah AI

> **Status: rebuild in progress. Noah has no validated forecast skill yet.**
> Do not use this repository, or any deployment built from it, as a source of flood information or warnings.

*Ringkas: Noah AI sedang dibangun ulang sebagai alat pendukung keputusan untuk operator pengendali banjir DSDA dan BPBD DKI Jakarta. Belum ada prakiraan yang tervalidasi. Noah tidak mengeluarkan peringatan publik.*

## What Noah is becoming

Noah AI started as a hackathon flood app for the public (2025). It is being rebuilt into a
**decision-support module for flood-control operators in DKI Jakarta**: Dinas Sumber Daya Air
(DSDA), its pump-house operators, and BPBD DKI.

The target, described in [`docs/plan/00_INDEX.md`](docs/plan/00_INDEX.md):

- **M1 Evaluation:** log every forecast (Noah's and other sources') and match it against what
  actually flooded, so skill is always visible as POD, FAR, CSI, Brier score and lead time,
  next to a simple baseline.
- **M2 Impact nowcast:** per-polder and per-kelurahan flood probability 1 to 3 hours ahead, with
  recommendations for where pumps and crews could go.
- **M3 Polder operations:** polder water balance, time to full, drawdown advice and pump anomalies.

Noah **recommends; operators decide.** It sends nothing to the public and never writes to SCADA,
pumps or gates.

## What it is not

- **Not a public warning system.** Under UU 31/2009 and UU 24/2007, meteorological warnings are
  BMKG's role and disaster warnings are BPBD's. Noah output goes only to authenticated operators.
- **Not a validated forecaster.** The hackathon LSTM, its "physics engine" blend, the demo
  "GOD MODE" and the canned scenarios have been removed. No replacement model exists yet; any
  future model must beat the baseline on M1 metrics before it is used.
- **Not a CCTV analytics service.** The Roboflow/YOLO image path was removed. CCTV will only be
  considered once DSDA camera access is granted.

## Current state

The repository is mid-rebuild (roadmap week W1). Expect pages and API routes from the hackathon
version to disappear or show empty states ("Belum ada data") until real data connectors land.
The audit and backlog driving the rebuild are in [`docs/audit/`](docs/audit/).

| Part | Path | State |
|---|---|---|
| Operator UI | `app/`, `components/` (Next.js) | Being stripped of mock data and out-of-scope features |
| v1 API | `ml-service/` (FastAPI) | Skeleton only; see [`ml-service/README.md`](ml-service/README.md) |
| Plan | `docs/plan/` | Source of truth for scope, architecture and acceptance |
| Hackathon docs | `docs/archive/hackathon-2025/` | Superseded; kept for history only |

Links to the hackathon deployment and demo video were removed: that build displayed simulated
and replayed data as if it were live.

## Development

Prerequisites: Node.js 18+, Python 3.12.

```bash
# Next.js app
npm install
cp .env.example .env.local   # fill in values locally; never commit secrets
npm run dev

# v1 API skeleton and tests
cd ml-service
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
```

Container and deployment setup is being reworked (backlog B-030).

Rules every change must follow: [`docs/plan/10_GUARDRAILS.md`](docs/plan/10_GUARDRAILS.md)
(no public warnings, no infrastructure control, no fake data in production paths, append-only
facts, provenance on every value, UTC storage with WIB display, secrets only in environment
variables).

## Team (hackathon 2025)

Moh Ari Alexander Aziz, Tiffany Viriya Chu, Jason Edward Salim, Putri Dzakiyah, Naufarrel Zhafif.

## License

MIT. See [LICENSE](LICENSE).
