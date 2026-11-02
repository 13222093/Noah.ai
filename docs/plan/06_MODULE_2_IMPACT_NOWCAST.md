# 06. Module 2: Impact nowcast and recommendations

## Purpose
For each lighthouse polder and the kelurahan inside it, estimate the probability of flooding within 60, 120, and 180 minutes, the exposed population, and the action an operator should consider now.

## Build order (do not skip steps)
1. **Static susceptibility layer.** From DEM S9, apply subsidence correction `DEM_t = DEM_survey - rate_zone * (t - t_survey)` using S11; compute filled depressions and HAND (height above nearest drainage); aggregate per kelurahan and polder (share of area below thresholds, depression volume). Store as versioned rasters and per-unit features.
2. **Baseline rule (ships Week 3).** Per polder, learn thresholds from history: cumulative rain in the past 1 h and 3 h plus forecast rain in the next 1 to 3 h, and downstream water level relative to Siaga, that preceded flood events in the archive. Output a probability by logistic fit on these few features or by empirical frequency. This baseline is logged as source `baseline` forever.
3. **Pump-aware adjustment.** If M3 says the sump will be full within the lead time, raise probability; if pumps are off or anomalous, raise it further. Document the rule.
4. **ML model (Weeks 4 to 9, only if it wins).** Gradient boosting (LightGBM or XGBoost) on the same features plus susceptibility and seasonality. Replace the baseline in recommendations only if its CSI at 60 minutes and above is higher on a held-out period and FAR is not worse. Keep logging both.
5. **Rain nowcast upgrade.** When BMKG gridded data or radar arrives, run pySTEPS (BSD-3) to produce probabilistic rain fields for 0 to 3 h and feed them in. Until then use BMKG products as provided, with Open-Meteo only as a labeled fallback.

## Impact
Exposed population per unit from S14 multiplied by the share of the unit predicted wet. Also list critical facilities if available (hospitals, schools, major roads).

## Recommendations (trigger to action table, IFRC/510 IBF style)
Stored as configuration, reviewed with DSDA:
| Trigger | Suggested action | Recipient |
|---|---|---|
| P(flood within 120 min) >= 0.6 and M3 sump fill > 50% | Start pumps now for pre-emptive drawdown | Pump-house operator |
| P >= 0.6 and polder has no or insufficient stationary pumps | Dispatch N mobile pumps to listed points | Posko Banjir |
| P >= 0.7 and exposed population above threshold | Pre-position Pasukan Biru crew | Posko Banjir |
| M3 pump anomaly during rain | Inspect pump X | Pump-house operator |
| Upstream (Katulampa or Depok) rising fast | Watch gate Y, expect downstream rise in about Z hours | Posko Banjir |
Messages are short, in Bahasa Indonesia, include probability, time window, reason, and a link to the dashboard. Rate-limit: no more than one message per polder per 30 minutes unless the category changes.

## Explicit exclusions
- No public-facing outputs.
- No deep-learning nowcast from scratch; DGMR weights are not public.
- No RW-level claims while using the 20 m DEM.

## Acceptance
- Week 3: baseline and susceptibility live for lighthouse polders, outputs written to `forecasts`, recommendations delivered to the operator group in shadow mode.
- Every output row carries `model_version` and input timestamps.
- Backtest report comparing baseline and any ML model with M1 metrics.
