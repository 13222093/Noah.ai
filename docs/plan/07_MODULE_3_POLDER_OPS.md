# 07. Module 3: Polder operations

## Purpose
For pump houses with SCADA, tell the operator how full the sump is, when it will be full at the forecast rain, whether to start pumps early, and whether a pump is underperforming.

## Water balance
For each polder, at each time step dt (5 min):
```
V(t+dt) = V(t) + Q_in * dt - sum(Q_pump_i * on_i) * dt
Q_in    = rain_rate * catchment_area * runoff_coeff + Q_inflow_other
time_to_full = (V_max - V_now) / max(Q_in_forecast - Q_pump_capacity_on, epsilon)
```
Parameters in `polder_params` (catchment area, runoff coefficient, level-to-volume curve, V_max), initially estimated from DEM and drainage data and calibrated against SCADA levels once logs exist. Document every assumption.

## Pre-emptive drawdown advice (Garmerwolde-style rule)
- "Wet" state: M2 probability above threshold within 2 to 3 h, or forecast rain above X mm/h. Advice: run pumps to lower the sump to a target level before rain.
- "Dry" state: normal operation.
- Advice only. Never write setpoints to SCADA.

## Pump anomaly detection
- Rule 1: pump reported ON for more than N minutes and sump level not falling at the expected rate given capacity and inflow.
- Rule 2: pump OFF while level above start threshold.
- Rule 3 (when current or frequency data exists): residual against the pump curve.
Alert the pump-house operator; log every alert for later validation.

## Before SCADA access
Run in simulator mode using inventory capacities and synthetic level series, clearly labeled "SIMULASI" in UI and excluded from M1 metrics. Interfaces must be identical so real data drops in.

## Optional
EPA SWMM model per lighthouse polder via pyswmm if DSDA provides network data, used to calibrate parameters and as a teacher for later surrogates. GNN surrogates are research only and, if GPL-licensed code is used, must run as a separate service.

## Acceptance
- Week 3: simulator mode end to end on dashboard.
- Within 1 week of receiving SCADA logs: calibrated parameters for at least one polder, time-to-full error reported against observed events.
