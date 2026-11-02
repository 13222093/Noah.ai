# 08. Roles and access

No public access during the trial. Every page requires login. Every action is written to `audit_log`.

| Role | Who | Can see | Can do |
|---|---|---|---|
| `posko_operator` | Posko Banjir DSDA | All lighthouse polders: nowcast, recommendations, M3 status, latest observations, connector health | Acknowledge recommendations and record action taken |
| `pump_operator` | Pump-house staff of a given polder | Their polder only: sump level, pumps, time to full, drawdown advice, anomalies | Acknowledge, record action, flag a sensor as faulty |
| `bpbd_pusdalops` | Pusdalops BPBD | Nowcast and exposure per kelurahan, flood reports, recommendations | Acknowledge, add a flood report correction (appended, not overwritten) |
| `dsda_supervisor` | DSDA management | Everything above plus scoreboard and weekly reports | Export reports; approve trigger-to-action table changes |
| `researcher` | ITB/SCCIC team | Everything, including raw data and model versions | Run backtests, deploy model versions to staging, propose threshold changes |
| `admin` | Project lead | Everything | Manage users, roles, connectors, configuration |

Implementation notes:
- Authentication via OIDC (adapter so it can switch to SCCIC ISSP Keycloak later). Supabase Auth is acceptable behind that adapter.
- Authorization enforced in the API (and in Postgres row-level security where Supabase is used), not only in the UI.
- Phone numbers for WhatsApp recipients are stored hashed plus an encrypted contact table with access limited to admin (UU PDP).
- The existing public subscriber table and citizen SMS flow are out of scope (see `10_GUARDRAILS.md`).

## UI pages per role (minimum)
1. **Ringkasan** (overview map): lighthouse polders colored by current probability, connector health strip.
2. **Polder detail**: level chart, rain chart, pumps, time to full, open recommendations, history.
3. **Rekomendasi**: queue with acknowledge and action fields.
4. **Skor** (scoreboard): M1 metrics with plain-language explanations.
5. **Laporan**: weekly reports.
6. **Admin**: users, stations, thresholds, trigger-to-action table, connectors.
