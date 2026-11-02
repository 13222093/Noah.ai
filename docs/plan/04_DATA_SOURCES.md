# 04. Data sources

Status legend: **OPEN** usable now; **REQUESTED** formal request pending; **CLOSED** not accessible yet; **FREE-FALLBACK** free alternative used until the primary arrives.

| # | Source | Owner | Content | Access | Status | Minimum spec to be useful | Fallback |
|---|---|---|---|---|---|---|---|
| S1 | Posko Banjir DSDA, https://poskobanjir.dsdadki.web.id/ | DSDA | Water level (TMA) at about 38 posts (Katulampa, Depok, Manggarai, Karet, Marina, Pasar Ikan, Sunter Hulu, and others), about 5-minute updates, Siaga status | Public web table; an undocumented XML endpoint exists. Use politely (one request per 5 min), cache, identify the client; formal permission requested | OPEN, REQUESTED for official use | Interval at most 10 min; 1 cm resolution; delay under 15 min; datum documented | none; this is the backbone |
| S2 | Open Data Jakarta TMA archives 2018 to 2020 | DSDA | Monthly water-level datasets | Download from data.jakarta.go.id | OPEN | Hourly or better | n/a |
| S3 | DSDA archive TMA and rainfall (55 ARR) 2020 to 2026, 5-minute | DSDA | Historical telemetry | Formal data request (layanan permohonan data) | REQUESTED | Same as S1 | S1 recorded from now on |
| S4 | BPBD Info Banjir, https://bpbd.jakarta.go.id/infobanjir | BPBD DKI | Flooded RTs per hour, depth, gate status | Public page; archive by request | OPEN (live), REQUESTED (archive) | Start and end time, depth, RT code; consistent definition | PetaBencana, JAKI reports |
| S5 | BMKG nowcasting | BMKG | Rain nowcast 1 to 6 h, every 10 min; impact-based forecasting pilot for Jabodetabek | Public images now; data format by research agreement | OPEN (images), REQUESTED (data) | Gridded data at 10 min | Open-Meteo forecast API (free) for coarse rain; label clearly as fallback |
| S6 | SCADA pump houses (examples: Pulomas 2, Setiabudi Timur, Waduk Bojong Indah, Sunter Selatan) | DSDA | Pump on/off, sump level, gate opening | Cooperation agreement | REQUESTED | Status at least every 15 min; capacities in m3/s; one wet season of history | Simulator with inventory capacities until granted |
| S7 | Pump inventory per pump house | DSDA | Count, capacity m3/s, location | Data request; aggregates are public (612 stationary pumps at 211 locations, 590 mobile, December 2025) | REQUESTED | Per-house capacity | Aggregates plus manual entry for lighthouse polders |
| S8 | Drainage network and polder boundaries (SIGA/MAPID) | DSDA | Channels, polder geometry | Cooperation agreement | REQUESTED | Polder boundary polygons at minimum | Derive catchments from DEM; manual digitizing for lighthouse polders |
| S9 | DEM LiDAR DKI 20 m, http://gis.bpbd.jakarta.go.id/layers/geonode:jkt_20m | BIG via BPBD GeoNode | Elevation | Download | OPEN | 20 m acceptable at polder level | DEMNAS 8 m (worse vertical accuracy) |
| S10 | LiDAR native resolution (1 m or finer) | BIG | Elevation for RW level | Formal request | CLOSED | n/a | S9 |
| S11 | Subsidence rates per zone (InSAR) | ITB Geodesy (Andreas et al., PLOS Water 2024) | mm/year per zone | Publication data | OPEN | Per-zone rate | DSDA statement of 8 to 20 cm/year as bounds |
| S12 | CCTV at posts and pump houses (118 cameras) | DSDA via Diskominfotik | Video or snapshots | Permission through Diskominfotik | REQUESTED | Snapshot at least per minute; 720p; fixed position; staff gauge or fixed reference visible; night lighting | none; CCTV is supplementary |
| S13 | Katulampa, Depok, Manggarai levels | BBWS Ciliwung-Cisadane | Upstream river levels | Via S1 already | OPEN | as S1 | n/a |
| S14 | Population and buildings per kelurahan/RW | BPS, Jakarta Satu | Exposure | Download | OPEN | Kelurahan level | n/a |
| S15 | PetaBencana.id | Yayasan Peta Bencana | Crowd flood reports | Public API | OPEN | Geolocated, timestamped | n/a |
| S16 | JaWaRA early warning (DKI + SAS) | Pemprov DKI | Possibly existing flood EWS | Unknown; ask DSDA | CLOSED | Archived forecasts with timestamps | Exclude from M1 until accessible |
| S17 | Google Flood Hub | Google | Coarse flash-flood forecast 24 h, 20 km grid | Public site | OPEN (coverage of Jakarta unverified) | n/a | Log only if retrievable; never use as M2 input |

## Rules for connectors
- One connector per source; isolated failure; exponential backoff; respect robots and terms; no scraping faster than the source updates.
- Store the raw payload (object storage) and the normalized rows (database) with `ingested_at` and `raw_ref`.
- Validate units and ranges; flag, do not drop, suspicious values (`quality_flag`).
- Station metadata, datums, and Siaga thresholds are configuration, not code (D12). Manggarai: Siaga 3 above 750 cm, Siaga 2 above 850 cm, Siaga 1 above 950 cm; other stations from DSDA's table.
- A health endpoint reports freshness per connector; an alert fires if any connector is stale more than 15 minutes.
