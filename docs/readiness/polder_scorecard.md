# Polder readiness scorecard (B-042, G-056)

Status: **DRAFT v0.1, 2026-11-02.** Prepared by the hydro-ml-engineer agent for Ari and DSDA.
Machine-readable copy: `config/polder_candidates.yaml` (same criteria, scores, and sources).

**The lighthouse polders are chosen with DSDA in Week 1** (`01_PRODUCT_BRIEF.md` Scope). This scorecard is an input to that meeting, not the decision. A quarter of the weight, including operator willingness, can only be filled by DSDA.

## 1. Method

### Criteria and weights (sum 100)
| ID | Criterion | Plan source | Weight | Why it matters |
|---|---|---|---|---|
| c1 | Flood frequency and impact history | S4 (S15) | 20 | M1 needs events to score; M2 needs history to learn thresholds |
| c2 | SCADA presence and access prospect | S6 | 20 | M3 calibration needs sump level and pump state; W7 to W8 acceptance |
| c3 | TMA post coverage | S1, S2 | 15 | Live water-level input to M2 and the DSDA Siaga baseline in M1 |
| c4 | Rain gauge (ARR) coverage | S3 | 5 | Local rain truth; low weight because S3 is not yet granted |
| c5 | CCTV with staff gauge or fixed reference | S12 | 5 | Supplementary flood truth; low weight (`04`: "CCTV is supplementary") |
| c6 | Polder boundary data | S8 | 10 | Needed by W2 for `spatial_units` (B-058) and the water balance |
| c7 | Pump inventory per pump house | S7 | 10 | Mobile-pump recommendations and M3 capacities; never invented (G-052) |
| c8 | DSDA and operator willingness | DSDA | 10 | Success criterion 5 needs an operator who uses the advice |
| c9 | Exposure (population, facilities) | S14 | 5 | Impact estimate; computable in W2 (B-059) |

Level definitions (0 to 3) for every criterion are in `config/polder_candidates.yaml`. Summary:
3 = official data in hand or confirmed by DSDA; 2 = confirmed by an official or press source; 1 = indirect, older, planned, or plan-only evidence; 0 = confirmed absent; **null = unknown, ask DSDA/BPBD**. Unknowns are never guessed.

### Scoring rule
- `score = sum(weight * s / 3)` over criteria with a known score (0 to 100).
- `potential_max = score + weight of unknown criteria` (the ceiling if every unknown came back best).
- `confidence` of a score = known weight / 100: high at 0.8 or more, medium 0.6 to 0.8, low below 0.6.
- Ranking: score, then c2 (SCADA), then potential_max.
- **Gates** (must hold before a polder becomes a lighthouse): g1 DSDA confirms a willing operator contact (c8 at least 2); g2 at least one usable water-level signal (c2 at least 2 or c3 at least 2); g3 a boundary obtainable by end of W2 (c6 at least 1).
- **Portfolio rule:** choose 2 to 3. At least one with confirmed SCADA. Prefer polders whose nearest S1 posts differ, so one gauge does not drive the whole evaluation.

### Evidence used
- The plan's own facts (`04` S6 examples: Pulomas 2, Setiabudi Timur, Waduk Bojong Indah, Sunter Selatan).
- The repo's S2 archive `ml-service/data/tma_2020.xlsx.csv` (21 posts, 2019-12-31 to 2020-01-31, mm). Distances below are great-circle distances from an OpenStreetMap reference point (R11) to each post. Distance is not hydraulic connection; that is marked separately.
- Public sources R1 to R12 (section 5), all accessed 2026-11-02.

## 2. Scores
| Rank | Candidate | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 | c9 | Score | Potential max | Known weight | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Pulomas (Pulomas 2, Waduk Ria Rio) | 1 | **2** | 1 | ? | ? | 1 | 1 | ? | ? | **31.7** | 56.7 | 75 | medium |
| 2 | Sunter Selatan (+ Sunter C) | **2** | 1 | 1 | ? | ? | 1 | 1 | ? | ? | **31.7** | 56.7 | 75 | medium |
| 3 | Setiabudi Timur | 1 | 1 | **2** | ? | ? | 1 | 1 | ? | ? | **30.0** | 55.0 | 75 | medium |
| 4 | Kelapa Gading (unit unclear) | **2** | ? | 1 | ? | ? | 1 | 1 | ? | ? | **25.0** | 70.0 | 55 | low |
| 5 | Waduk Bojong Indah | ? | 1 | 0 | ? | ? | ? | 1 | ? | ? | **10.0** | 65.0 | 45 | low |

`?` = unknown, ask DSDA (c4, c5, c8, c9 are unknown for every candidate).

**Ranking confidence: low.** The top three are within 2 points, all gates are still open (no c8 yet), and Kelapa Gading has the highest ceiling. Pulomas leads only on the tie-break: it is the only candidate with SCADA confirmed by a public source (R1).

### Evidence per candidate
**Pulomas** (Kayu Putih, Pulo Gadung, Jakarta Timur)
- c1 = 1: before the pump house, RW 09 Kayu Putih flooded 50 to 100 cm; afterwards about 20 cm, and RT 02/06 stopped flooding (R1). Recurrence is mostly pre-intervention, so there may be few events left to score.
- c2 = 2: SCADA working at Pulomas 2, with pumps run from a computer or phone and error reporting (R1, Feb 2024). DSDA says local SCADA sits at each house with a central DSDA server (R2).
- c3 = 1: Pompa Yos Sudarso 1 (Sunter Timur) at 1.4 km, link unconfirmed. The polder discharges to Kali Sunter (R1); PA. Pulo Gadung (Sunter) is 3.7 km away.
- c6 = 1: inflow channels named (IKIP, Pulo Nangka Barat, Pulomas Barat) (R1).
- c7 = 1: planned total 5.5 m3/s (R5, 2022); three pumps with internally inconsistent figures (R1).

**Sunter Selatan** (Sunter Jaya / Sunter Agung / Sungai Bambu, Tanjung Priok, Jakarta Utara)
- c1 = 2: recurring 20 to 50 cm inundation 2020 to 2023 at Jl. Danau Sunter Utara and Jl. Gaya Motor (R3). Sunter C (May 2025) may reduce future events.
- c2 = 1: listed in `04` S6. Sunter C has a "digital system" to monitor each pump in real time (R3), not named SCADA.
- c3 = 1: Yos Sudarso 1 at 1.3 km, link unconfirmed.
- c6 = 1: served kelurahan named (R3). c7 = 1: Sunter C is 3 x 2.0 m3/s plus a 0.25 m3/s sludge pump (R3). Sunter Selatan's own pumps are unknown.

**Setiabudi Timur** (Guntur / Setiabudi, Jakarta Selatan)
- c1 = 1: described as a vulnerable point in central Jakarta (R4, 2018). There was 40 cm on Jl. HR Rasuna Said, Kuningan, on 7 July 2025 (R8). Kuningan drains to this reservoir (R4), but the report does not show a polder failure.
- c2 = 1: listed in `04` S6 only.
- c3 = 2: pumps discharge to the Banjir Kanal Barat (R4). P.A. Karet (BKB) is 2.3 km away and was in Siaga 1 to 3 for 97 of its 1,479 S2 rows in January 2020. Manggarai is 2.1 km upstream of the BKB split. A current S1 post, Rumah Pompa Atma Jaya (Kali Krukut), is listed (R10) but its coordinates are not in the repo.
- c6 = 1: about 134 ha, with inflow from Halimun, Menteng Atas, Pancoran and Kuningan (R4). c7 = 1: 3 x 1.74 plus 3 x 1.1 m3/s, as of 2018 (R4).

**Kelapa Gading** (Kelapa Gading Barat/Timur, Pegangsaan Dua, Jakarta Utara)
- The polder unit is unclear. "Polder Kelapa Gading" (pump houses on Kali Betik and Kali Gendong, R6) and Artha Gading (R5) are separate projects. DSDA must name the unit.
- c1 = 2: DSDA's 2020 to 2025 inundation map shows yearly recurring 15 to 40 cm at Pegangsaan Dua (R7).
- c2 = unknown: no source either way.
- c3 = 1: Yos Sudarso 1 at 1.9 km, Pulo Gadung at 3.5 km, links unconfirmed.
- c6 = 1: gate alignment from north Kelapa Gading to south Pegangsaan (R6). c7 = 1: Kali Betik 7 m3/s and Artha Gading 7 m3/s planned for December 2022 (R5); completion not confirmed.

**Waduk Bojong Indah** (Rawa Buaya, Cengkareng, Jakarta Barat). Added because `04` S6 names it as a SCADA example.
- c2 = 1: plan only. c3 = 0: the nearest S2 post is 6.1 km away (Kali Duri). The current S1 table lists "P.A. Cengkareng Drain" (R10) with no coordinates in the repo. If it is close, c3 rises to 2.
- c7 = 1: four pumps under repair in 2016, capacities not stated (R12).

### Watchlist (not scored)
- **Rumah Pompa Tipala (Cipinang):** an S1 post (R10) and named as a SCADA implementation site (R9). Ask DSDA which polder it serves and whether that polder floods.
- **Polder Pluit:** has an S1/S2 post at the pump house (c3 would be 3). It is very large, tidal and coastal, and its negative S2 values are unexplained (G-043). Not advised as a first lighthouse.

## 3. Reading the result
- **Shared-gauge risk.** Pulomas, Sunter Selatan and Kelapa Gading all depend on the same S1 post (Yos Sudarso 1), and Pulo Gadung is second for all three. Setiabudi Timur sits on a different system (BKB/Manggarai). The portfolio rule therefore favors **Pulomas + Setiabudi Timur**, with Sunter Selatan or Kelapa Gading as the third, depending on which DSDA confirms for SCADA and willingness.
- **S2 data quality near the Sunter candidates.** In the January 2020 archive, PA. Pulo Gadung has only 544 distinct timestamps in 1,479 rows (many repeats), a minimum of -100 mm, and it never left "Normal". Yos Sudarso 1 never left "Normal" (maximum 840 mm). Their Siaga thresholds and datums must come from DSDA (GAP_REPORT DSDA Q2) before they can support the c3 scores.
- **Post-intervention polders score fewer events.** New pump houses at Pulomas (R1) and Sunter C (R3) may leave too few floods in one wet season for M1 to separate Noah from the baseline. The S4 archive answers this.

## 4. Questions that would change the ranking
Ranked by how much each could move the scores:
1. **DSDA: which polders do you nominate, and is there a named pump-house operator and Sudin SDA contact for shadow mode?** (c8, gate g1; 10 points, and it can veto.)
2. **DSDA: is SCADA live, with at least one wet season of logs, at Setiabudi Timur, Sunter Selatan, Kelapa Gading (Kali Betik, Artha Gading) and Bojong Indah? Can Noah have read-only access?** (c2; up to 20 points. Kelapa Gading could jump to first.)
3. **BPBD: flooded-RT counts per polder for 2020 to 2026, especially after Pulomas 2 and Sunter C started.** (c1; 20 points.)
4. **DSDA: coordinates, datums and Siaga tables for the S1 posts, plus which posts each polder drains to** (Yos Sudarso 1, Pulo Gadung, Cengkareng Drain, Atma Jaya, Lagoa). (c3; 15 points.)
5. **DSDA: can S8 polygons and S7 per-house pump inventories for the shortlisted polders arrive before W2?** (c6, c7, gate g3; 20 points.)
6. Also: which ARR gauges (S3) and CCTV with staff gauges (S12) are inside or near each polder? (c4, c5; 10 points.)

After the W1 meeting, fill the nulls in `config/polder_candidates.yaml`, recompute, and record the decision and its date here.

## 5. Sources (all accessed 2026-11-02)
| ID | Source | Published |
|---|---|---|
| R1 | Berita Jakarta, "SCADA at Pulomas 2 Pump House Assists Water Debit Management", https://m.beritajakarta.id/en/read/54129/scada-at-pulomas-2-pump-house-assists-water-debit-management | 2024-02-19 |
| R2 | Dinas SDA DKI, "Mengenal Sistem SCADA yang Mampu Kendalikan Rumah Pompa dari Jarak Jauh", https://dsda.jakarta.go.id/detail-artikel/mengenal-sistem-scada-yang-mampu-kendalikan-rumah-pompa-dari-jarak-jauh/53 | 2025-05-05 |
| R3 | Dinas SDA DKI, "Diresmikan Gubernur Pramono Anung, Pompa Sunter C ...", https://dsda.jakarta.go.id/detail-artikel/diresmikan-gubernur-pramono-anung-pompa-sunter-c-diharapkan-efektif-kendalikan-banjir-di-sunter-agung-dan-sungai-bambu/62 | 2025-05-26 |
| R4 | CNN Indonesia, "Berharap pada Pompa Sang Penjaga Banjir Ibu Kota", https://www.cnnindonesia.com/nasional/20181029065504-20-342171/berharap-pada-pompa-sang-penjaga-banjir-ibu-kota | 2018-10-31 |
| R5 | IDX Channel, "Cegah Banjir, DPRD DKI Minta Proyek Empat Rumah Pompa Rampung Desember 2022", https://www.idxchannel.com/economics/cegah-banjir-dprd-dki-minta-proyek-empat-rumah-pompa-rampung-desember-2022/all | 2022-09-07 |
| R6 | Berita Jakarta, "Kelapa Gading Polder Construction is Important to Overcome Flooding", https://m.beritajakarta.id/en/read/41995/kelapa-gading-polder-construction-is-important-to-overcome-flooding | 2021-11-26 |
| R7 | Dinas SDA DKI, "Kali Cakung Lama Dikeruk ... Atasi Banjir di Kelapa Gading", https://dsda.jakarta.go.id/detail-artikel/kali-cakung-lama-dikeruk-gubernur-pramono-anung-pastikan-komitmen-pemprov-jakarta-atasi-banjir-di-kelapa-gading/58 | 2025-05-20 |
| R8 | RCTI+ / Okezone, "Jalan HR Rasuna Said Kuningan Banjir, Lalu Lintas Macet", https://www.rctiplus.com/news/detail/terkini/4803387/jalan-hr-rasuna-said-kuningan-banjir-lalu-lintas-macet | 2025-07-07 |
| R9 | Adianto et al., "Implementation of SCADA with Improvement of DKI Jakarta Flood Control Monitoring System", TIME in Physics 2(2):96-110, https://ejournal.universitasmandiri.ac.id/index.php/timeinphys/article/view/159 | 2024-09-30 |
| R10 | Posko Banjir DSDA public table (37 TMA posts listed), https://poskobanjir.dsdadki.web.id/ | live |
| R11 | OpenStreetMap Nominatim, reference points only (ODbL), https://nominatim.openstreetmap.org/ | live |
| R12 | Berita Jakarta, "Damaged Pumps Repair at Bojong Reservoir Takes A Month", https://m.beritajakarta.id/en/read/17546/damaged-pumps-repair-at-bojong-reservoir-takes-a-month | 2016-09-20 |
| repo | `ml-service/data/tma_2020.xlsx.csv` (S2). Provenance, licence and time zone are still open (GAP_REPORT Ari Q5, DSDA Q3) | 2020 data |

Press figures are evidence of existence, not engineering data. Capacities used by M3 come only from S7 or DSDA confirmation (G-052).
