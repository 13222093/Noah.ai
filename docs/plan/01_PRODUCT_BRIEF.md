# 01. Product brief

## One sentence
Noah AI turns forecasts and sensor data Jakarta already has into **polder-level flood forecasts for the next 1 to 3 hours, concrete pump and crew recommendations, and an open scoreboard of how accurate every forecast was**, for the operators who run Jakarta's flood control.

## Why the pivot
The old Noah was a public flood app covering 34 provinces. Jakarta's public warning layer is already crowded (BMKG nowcasting, Pantau Banjir, Info Banjir BPBD, JAKI, PetaBencana, Google Flood Hub), and by law (UU 31/2009) only BMKG may issue meteorological warnings. What is missing is the layer between "rain is coming" and "send pumps here now", and nobody in DKI publishes how accurate their flood forecasts are.

## Users (detail in `08_ROLES_AND_ACCESS.md`)
1. **Posko Banjir DSDA operators**: decide where to send mobile pumps (590 units) and Satgas Pasukan Biru crews.
2. **Pump-house operators** at polders with SCADA: decide when to start pumps and whether to draw down the sump before rain.
3. **Pusdalops BPBD DKI**: track RT-level flood reports and coordinate response.
4. **DSDA supervisors**: review the weekly scoreboard.
5. **ITB/SCCIC researchers**: run backtests, maintain models.

No public users during the trial.

## Three modules
| Module | Answers | Depends on | Ship target |
|---|---|---|---|
| M1 Open evaluation | How accurate were BMKG, DSDA Siaga status, JaWaRA (if accessible), and Noah forecasts? | Open data only | Week 2 |
| M2 Impact nowcast | Which polder or kelurahan floods in 1, 2, 3 h, how many people, and what to do now | BMKG rain, water levels, LiDAR DEM, BPBD history | Week 3 |
| M3 Polder operations | When does this sump fill, should pumps start early, is a pump failing | SCADA logs (when granted), pump inventory | Week 3 (simulated), Weeks 4 to 9 (real) |

## Scope for October to December 2026
- 2 to 3 lighthouse polders in DKI Jakarta chosen with a readiness scorecard (likely candidates: Pulomas, Sunter Selatan, Setiabudi Timur, Kelapa Gading; decided in Week 1).
- Shadow mode: Noah runs fully and sends recommendations, but no DSDA procedure changes because of it.
- Output channels: internal operator dashboard and one WhatsApp group chosen by DSDA.

## Explicit non-goals until further notice
- Public alerts, SMS to residents, push notifications to citizens.
- Any command to SCADA, pumps, or gates.
- Riverine forecasting of the Ciliwung as a product (J-FEWS and BBWS already cover it; Katulampa and Depok levels are used only as inputs).
- National coverage, 34-province selectors, shelters and routing for the public, generic weather or air-quality layers.
- Building generic platform features that SCCIC ITB's ISSP already provides (SSO, data hub, situation room) beyond a thin compatible version.
- Deep-learning rainfall nowcasting from scratch (no raw radar yet; DGMR weights are not public).

## Success at the end of December 2026
1. System running at Posko Banjir DSDA and Pusdalops BPBD with documentation.
2. Evaluation report: POD, FAR, CSI, lead time for Noah and for every other logged source, per polder and lead time.
3. List of data sources proven available and still closed.
4. List of blind spots: polders that flood often but have no usable sensor or CCTV.
5. Continuation decision: Noah CSI beats the rainfall-threshold baseline at lead time of 60 minutes or more, FAR below 0.5, and at least one operator says recommendations were used.

## Positioning in the SCCIC ITB ecosystem
Noah is a flood-domain module. SCCIC already has ISSP (integration), ORION (IoT asset monitoring), VIANA (CCTV analytics), CITYA (operator assistant), MIRRA/Digital Twin, and Spatial Readiness Assessment. Noah contributes what they lack: polder hydrology, flood impact forecasting, and open evaluation. Build Noah so it can run standalone **and** plug into ISSP (see `03_TARGET_ARCHITECTURE.md`, section "ISSP compatibility").
