# Formal data requests (B-043)

Drafts of formal letters in Bahasa Indonesia, one per source in `docs/plan/04_DATA_SOURCES.md`. **Nothing here has been sent.** Ari sends them (B-043 human step). After sending, update the table below; when a source is granted, update its status in `04` as well.

Every letter states the same limits: decision support for operators only, shadow mode, no public warnings (UU 31/2009, UU 24/2007), no writes to SCADA, pumps or gates, use only under a PKS or written permission, no redistribution of raw data, and UU PDP (UU 27/2022) handling.

## Tracking
| # | Request | Source | Recipient (institution / unit) | File | Status | Date sent | Ref. no. | Follow-up due | Response / notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Official permission for Posko Banjir data and XML endpoint, polling rate, datums, Siaga table | S1 | Dinas SDA DKI / unit that runs Posko Banjir | `01_S1_dsda_izin_posko_banjir.md` | draft | | | sent + 10 working days | |
| 2 | Archive of TMA (all posts) and 55 ARR gauges, 2020 to 2026, 5-min | S3 | Dinas SDA DKI / PPID Pembantu, data service | `02_S3_dsda_arsip_tma_arr.md` | draft | | | sent + 10 working days (KIP deadline) | |
| 3 | Info Banjir RT-level archive: January 2020, wet seasons 2024/25 and 2025/26 | S4 | BPBD DKI / Pusdalops PB, PPID | `03_S4_bpbd_arsip_info_banjir.md` | draft | | | sent + 10 working days | Also asks for event-definition sign-off |
| 4 | Read-only SCADA cooperation (PKS) for lighthouse pump houses | S6 | Dinas SDA DKI / pump-house and SCADA unit | `04_S6_dsda_kerja_sama_scada.md` | draft | | | sent + 10 working days | Needs PKS; lighthouse list first |
| 5 | Pump inventory per pump house (count, m3/s, levels) | S7 | Dinas SDA DKI / PPID, pump maintenance | `05_S7_dsda_inventaris_pompa.md` | draft | | | sent + 10 working days | Template annex to prepare |
| 6 | Polder boundaries and drainage network (SIGA/MAPID) | S8 | Dinas SDA DKI / geospatial (SIGA/MAPID) unit | `06_S8_dsda_batas_polder_siga.md` | draft | | | before end of W2 | Blocks B-058 |
| 7 | CCTV snapshots at posts and pump houses | S12 | Diskominfotik DKI / CCTV unit (cc: Dinas SDA) | `07_S12_diskominfotik_cctv.md` | draft | | | sent + 10 working days | Camera list annex with DSDA |
| 8 | Research agreement for gridded nowcast (10 min), radar, archive | S5 | BMKG / Deputi Meteorologi, nowcasting unit | `08_BMKG_nowcast_gridded.md` | draft | | | sent + 15 working days | Triggers pySTEPS (G-094) |
| 9 | API terms, rate limits, DKI filter, archive | S15 | Yayasan Peta Bencana / data team | `09_S15_petabencana_api_arsip.md` | draft | | | sent + 10 working days | Can go by email |

Status values: `draft`, `ready` (placeholders filled, signed), `sent`, `acknowledged`, `granted`, `partial`, `refused`, `closed`.

## Fill in before sending (all letters)
- Letter number, date, place, and SCCIC ITB letterhead.
- Signatory name and position. Confirm whether the head of SCCIC or an ITB official must sign letters to government agencies.
- Contact block: Ari's full name, position, email and phone.
- Recipient unit names marked "dikonfirmasi". Check them against the current SOTK of Dinas SDA, BPBD, Diskominfotik and BMKG. Person names are left out on purpose.
- Lighthouse polder names (`[nama polder]`), after the W1 decision (`docs/readiness/polder_scorecard.md`).
- End date of the shadow-mode trial.
- Annexes the letters mention: technical spec (S1, S3, S4, S6, S8, BMKG), pump inventory template (S7), camera list (S12), and draft PKS scope (S6).
- S12: the snapshot retention period `[N]` days. S15: the polling interval `[N]` minutes.
- Decide whether 1, 2, 4, 5 and 6 go to Dinas SDA as one bundled letter with annexes, or separately. DSDA may prefer a single PKS covering S1, S3, S6, S7, S8.
