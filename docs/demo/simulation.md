# Demo replay: Banjir 1 Januari 2020 (what is real, what is simulated)

Status: demo only. On this branch the replay lives in its own section, `/operator/**` (Ringkasan, Polder, Rekomendasi), added next to the original Noah AI app. **The original app's pages, features and design are unchanged**; the only shared edits are one "Operator" entry in the NavRail and additive, namespaced theme tokens (`op-*` Tailwind colours, `--op-*` CSS variables).

The `/operator` section is an explicitly labelled historical scenario, so it always shows this replay, whatever `NOAH_DEMO_MODE` says (`lib/ops/provider.ts`). Every operator screen keeps the violet **MODE SIMULASI AKTIF** strip and the **Skenario historis + simulasi** chip on screen, and every simulated value is labelled SIMULASI. Nothing here is counted in any M1 score.

Code: `lib/ops/demo/` (data loader `data.ts`, rule and simulation `engine.ts`, trigger table `triggers.ts`, provider `provider.ts`), built by `scripts/build-demo-scenario.mjs`.

## Window and clock
- 31 Des 2019 00:00 WIB to 2 Jan 2020 12:00 WIB (2019-12-30T17:00Z to 2020-01-02T05:00Z), 10-minute steps (361 steps).
- The DSDA archive only starts at 31 Des 23:40 WIB for most posts, so the replay suggests opening there (`ScenarioInfo.initialTs`). Before that only ERA5 rain exists.
- Timestamps are stored in UTC. The archive's `tanggal` column is read as WIB (the archive's time zone is still an open question: GAP_REPORT Ari Q5, DSDA Q3).

## What is real
| Data | Source | Provenance kind | Notes |
|---|---|---|---|
| Water level per post | `ml-service/data/tma_2020.xlsx.csv` (DSDA S2 archive), 21 posts, ~30 min | `historical` | mm converted to cm (÷10) in the build script only. Exact duplicate rows (scrape repeats) merged; every other reading kept and flagged. |
| DSDA Siaga status | same file, `status_siaga` | `historical` | What DSDA recorded, not recomputed. |
| 2020 Siaga thresholds | `config/stations.yaml` `evidence.s2_2020` | - | Derived value if the 2020 labels pin it down; otherwise today's DSDA value only if consistent with the 2020 bracket; otherwise null. Thresholds have changed since 2020 (e.g. Cibalok Siaga 3 was 140 cm, now 90). |
| Hourly rain per polder | Open-Meteo historical archive, `models=era5`, fetched once, raw response in `lib/ops/demo/raw/` | `reanalysis` | ERA5 grid ~0.25° (~28 km); the five polders fall in two cells. Open-Meteo's hourly value is the sum of the preceding hour; it is stored at the hour start. |

Quality flags (never drop): stuck sensor (>= 6 readings over >= 6 h, all identical: every point `suspect`), isolated spikes (stations.yaml rule: >= 100 cm from both neighbours on the same side, gaps <= 180 min; demo addition: >= 50 cm from both while the neighbours agree within a quarter of that, which catches Depok 163 → 75 → 157 cm), negatives where the post does not allow them.

Found in this event: Pompa Yos Sudarso 1 (0 cm) and PA. Pulo Gadung (344 cm) are constant through the whole event. They are the only posts linked to Pulomas, Sunter Selatan and Kelapa Gading, so those three polders are **blind spots**: their nowcast runs on rain only, and their reasons say so.

**ERA5 underestimates this event badly.** Its wettest hour is 7.2 mm (31 Des 17:00 to 18:00 WIB) and about 50 mm fell in the 24 h to 1 Jan 07:00 WIB in the cell, while BMKG recorded 377 mm/day at Halim Perdanakusuma, the highest since records began in 1866 (reported by [The Jakarta Post, 1 Jan 2020](https://www.thejakartapost.com/news/2020/01/01/not-ordinary-rain-worst-rainfall-in-over-decade-causes-massive-floods-in-jakarta.html) and [Mongabay Indonesia, 3 Jan 2020](https://mongabay.co.id/2020/01/03/bmkg-curah-hujan-paling-ekstrim-dalam-sejarah-jadi-pemicu-banjir-jakarta/)). ERA5's timing also peaks earlier than the gauges. The rain is replayed as is, not rescaled.

## What is simulated (`demo-rule-v1`)
Everything below carries `provenance.kind = 'simulated'`, `modelVersion = 'demo-rule-v1'`. It is a transparent hand-set rule, **not a validated or fitted model**.

### Nowcast (per polder, lead 60/120/180 min)
`p = logistic(logit)`, `logit = base + pump adjustment`, rounded to 3 decimals.

| Term | Feature | Weight |
|---|---|---|
| intercept | | -3.0 |
| rain past 1 h | ERA5 mm in the last **completed** hour | 0.25 / mm |
| rain past 3 h | ERA5 mm in the last 3 completed hours | 0.10 / mm |
| prakiraan hujan | ERA5 mm in [t, t + lead), hours split pro rata. The replay "knows" the next hours of reanalysis: a perfect-forecast stand-in, labelled "prakiraan hujan (dari data reanalisis, simulasi)". A real forecast would be worse. | 0.15 / mm |
| level | z = (cm - Siaga3) / (Siaga1 - Siaga3) with 2020 thresholds (Siaga2 fallback), clipped to [-1.5, 1.5]; best linked post; half weight if the post is > 3 km away | 2.0 |
| rise | cm/h over ~60 min (reading 30 to 90 min back) / 50, clipped to [-0.5, 2], same post rules | 0.6 |
| upstream | Ciliwung-linked polders only: max over Katulampa, Depok of clip(rise/50, 0, 2) + 0.5 if >= Siaga 3 | 0.3 per 60 min of lead |
| pump: sump full within lead | from the M3 status | +1.0 |
| pump: sump >= 90 % | | +0.5 |
| pump: anomaly | | +0.5 |

Rain weights are scaled for ERA5's cell-averaged rain; per-mm weights for gauge or radar rain would be several times smaller. A level or rise term is dropped (and a reason says why) when the post is stuck, has no valid reading in the last 90 min, or has no 2020 thresholds. Reasons are the terms contributing >= 0.15, largest first (max 4), then at most one strong negative term, then dropped-term notes. Categories: rendah < 0.3 <= sedang < 0.6 <= tinggi < 0.8 <= sangat tinggi. The rule is monotonic in every rain feature and P(60) <= P(120) <= P(180) (tested).

### Sump and pumps (plan 07 water balance, 10-min steps)
`V(t+dt) = V + Q_in dt - sum(Q_pump_i on_i) dt`, `Q_in = rain_rate * A * C`, capped at 0 and V_max (excess reported as overflow). `time_to_full = (V_max - V) / (Q_in_next_hour - Q_pumps_on)`, null when not filling. Assumptions (`SIM_ASSUMPTIONS` in `engine.ts`):

| Assumption | Value | Basis |
|---|---|---|
| catchment A | Setiabudi Timur 134 ha; others 150 ha | 134 ha from R4 (polder_candidates c6); 150 ha placeholder |
| runoff coefficient C | 0.75 | placeholder (urban) |
| usable sump volume V_max | 20 000 m3, all polders | placeholder |
| initial fill | 20 % | placeholder |
| pump capacity | Setiabudi Timur 3 x 1.74 + 3 x 1.1 m3/s | R4 (CNN Indonesia, Oct 2018), the only stated capacities |
| unknown pump (Pulomas x3, Bojong Indah x4) | 0.5 m3/s each | placeholder, deliberately small: unknown capacity is not assumed sufficient |
| unknown aggregate (Sunter Selatan, Kelapa Gading) | 1.0 m3/s | placeholder. Sunter C (2025) and Kali Betik / Artha Gading (planned 2022) did not exist in 2020 and are excluded |
| simulated operator policy | pump i on at 30 + 15 i % fill (max 85), all off at 15 % | placeholder; the simulated operator does not follow Noah's advice |
| wet/dry (drawdown) state | wet if base P(120 or 180) >= 0.5 or prakiraan hujan next 60 min >= 10 mm | plan 07 |
| anomaly rule 1 | a pump on >= 30 min and outflow over the last 30 min short of expected by > 25 % | plan 07 |
| **injected training fault** | Setiabudi Timur Pompa 1 delivers 40 % from 1 Jan 00:00 WIB | NOT a 2020 event; exists so the anomaly rule and "inspect pump" can be demonstrated. Disclosed in the UI. |

### Recommendations (`triggers.ts`, plan 06 table)
| Trigger | Action | Recipient | Window |
|---|---|---|---|
| anomaly rule 1 during rain (rain past 3 h >= 1 mm or wet) | inspect_pump | pump operator | 0 to 3 h, repeat after 6 h |
| P(120) >= 0.6 and sump > 50 % | drawdown | pump operator | 0 to 2 h |
| P(120) >= 0.6 and no pumps, unknown capacity, or peak inflow next 2 h > capacity | mobile_pump (N = deficit / 0.5 m3/s, 1 to 4; placeholder sizing) | Posko | 0 to 3 h |
| P(120) >= 0.7 (S14 exposure not yet available, so probability only) | crew | Posko | 0 to 3 h, repeat after 4 h |
| Katulampa or Depok rising >= 30 cm/h (Ciliwung-linked polders) | gate_watch on the linked Ciliwung post | Posko | +3 to 5 h (Depok) or +6 to 9 h (Katulampa): demo travel-time assumptions, need DSDA confirmation |

Rate limit (guardrail 17): at most one recommendation per polder per 30 min unless the P(120) category changed; when several triggers fire, the lowest priority number wins (order above). An action that is still open for the polder is repeated only if the category escalated. WhatsApp preview text: `[SIMULASI – Skenario 1 Jan 2020]`, polder, recipient, probability and category, window in WIB, reason, suggested action, `Saran: keputusan tetap di tangan operator.`, `Dasbor: /operator/polder/<id>`. Nothing is sent.

In this replay: Pulomas, Sunter Selatan and Kelapa Gading each get 5 (2 mobile_pump, 2 drawdown, 1 crew, all on 31 Des 17:00 to 21:00 WIB during ERA5's peak), Setiabudi Timur gets 15 (7 inspect_pump, 6 crew, 2 gate_watch, 1 Jan 01:50 to 2 Jan 02:00 WIB, driven by Manggarai/Karet levels and the upstream rise), Waduk Bojong Indah none (peak P(120) 0.57).

### Health
Three connector entries relative to playback time: arsip TMA DSDA S2 (newest non-stuck reading; stale after 45 min = 1.5 x cadence), Open-Meteo ERA5 (end of the last completed hour; stale after 90 min), and the demo engine itself.

## No peeking
A snapshot at time t (rounded down to the step) contains only readings with ts <= t, rain hours that ended by t, and nowcasts, statuses and recommendations issued at or before t. The only look-ahead is the labelled "prakiraan hujan" input inside the rule. Tested in `provider.test.ts`.

## Limitations
- ERA5 is coarse and far too dry for this event; rain-driven probabilities are low during the real overnight peak and highest on 31 Des afternoon when ERA5 peaks.
- Weights are hand-set, not fitted; no event labels (S4 flood reports) are used, so no skill can be claimed.
- Polder points are approximate reference points (OSM Nominatim), not S8 boundaries; post links are by distance, hydraulic links unconfirmed.
- Sump and pump parameters are placeholders except Setiabudi Timur's capacities (2018). Pump discharge does not depend on river level (no backwater, no DSDA pump-stop orders).
- The archive time zone and gauge datums are unconfirmed.

## Replacing this with a live provider
Pages read only through `lib/ops/hooks.ts`; on this branch `lib/ops/provider.ts` always returns the replay for the `/operator` section (the empty live stub is still exported as `emptyProvider`). A live provider implements the same `OpsProvider` interface from the v1 API: stations and readings from the S1 connector (`observed`), rain from BMKG products (Open-Meteo only as a labelled fallback), nowcasts from the logged `baseline` (plan 06 step 2) with its own `modelVersion`, M3 status from SCADA, recommendations from the reviewed trigger table, and acknowledgements stored server-side. `ScenarioInfo` becomes null and the SIMULASI labels disappear because `provenance.kind` is no longer `simulated` or `historical`.

## Rebuild
`node scripts/build-demo-scenario.mjs` (reuses the cached raw rain; `--refresh` re-fetches with one Open-Meteo request). It also reads `config/stations.yaml` and `config/polder_candidates.yaml`, which are not on this branch (they live on `w1-foundation`), so rebuild there; the built `lib/ops/demo/scenario-2020-01-01.json` is committed and is all the app and tests need.
