# 05. Module 1: Open evaluation

## Purpose
Record every forecast or alert that could have told an operator a flood was coming, match it with what actually happened, and publish accuracy numbers internally. This is Noah's foundation: it works with open data from day one, it judges Noah by the same rules as everyone else, and it is the evidence for the December decision.

## Sources logged as forecasts
| Source | What counts as a forecast | How to capture |
|---|---|---|
| Noah M2 | Each per-polder probability per lead time | Written directly by M2 |
| Baseline | Rainfall-threshold rule per polder (see `06`) | Written by M2 baseline job |
| DSDA Siaga status | Status change at a post (Siaga 3, 2, 1) treated as an alert for the polders/kelurahan it drains to; mapping table in config | From S1 snapshots |
| BMKG nowcast | Heavy-rain warning or nowcast cell above a threshold over a polder | From S5 (image parsing is acceptable as an interim if documented) |
| JaWaRA, Flood Hub | Only if their outputs can be retrieved with timestamps | Skip until accessible |

Every stored forecast is immutable and carries `issued_at`, `valid_from`, `valid_to`, `unit_id`, `probability` or `category`, and `model_version`.

## Event definition (version 1, to be agreed with DSDA and BPBD in Week 1)
A kelurahan (or polder) is **flooded in hour h** if at least one RT inside it is reported by BPBD with depth of 10 cm or more with a report time in hour h. Store this as `event_definitions` version `v1` with `agreed_with` filled once confirmed. Changes create a new version; metrics always state the version.

## Matching
- A forecast is a **positive** if probability is at or above the decision threshold (default 0.5, configurable per source; also report results across thresholds).
- **Hit**: positive and an event occurs in the unit within `[valid_from, valid_to]`.
- **False alarm**: positive and no event in the window.
- **Miss**: an event occurs and no positive forecast for that unit was issued before the event with the window covering it.
- **Correct negative**: neither.
- **Lead time**: event start minus the earliest `issued_at` of a positive forecast that covered it.
- When BPBD reports arrive late, re-run matching for the past 72 hours nightly. Verifications are appended, not updated; the latest `computed_at` wins.

## Metrics
- POD = hits / (hits + misses)
- FAR = false alarms / (hits + false alarms)
- CSI = hits / (hits + misses + false alarms)
- Frequency bias = (hits + false alarms) / (hits + misses)
- Brier score for probabilistic sources; reliability diagram data.
- Lead time: median and distribution.
Report per source, per polder, per lead time bucket (60, 120, 180 min), per week and cumulative. Never report accuracy or R2 for this problem.

## Outputs
- `GET /api/v1/scoreboard` for the dashboard.
- Weekly report (HTML and PDF) every Monday 07:00 WIB to DSDA supervisors, in Bahasa Indonesia, with a plain-language explanation of each metric.
- Internal only during the trial. No publication to media.

## Acceptance
- Unit tests for matching on hand-made cases including late reports, overlapping windows, and boundary times.
- Backtest on any available archive (S2, S3, S4 archive) produces metrics without errors.
- Live by Week 2 with at least DSDA Siaga and baseline sources.
