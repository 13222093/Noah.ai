# 🌊 noah.ai — Implementation Details

> What was built, how it works, and what each file does.

---

## Overview

noah.ai integrates three components into a **closed-loop flood intelligence system**:

1. **noah.ai** — Production-grade flood monitoring frontend (Next.js/Supabase)
2. **Jakarta-Floodnet** — LSTM flood prediction + YOLOv8 visual flood detection (Python/FastAPI)
3. **noah.ai** — The unified platform merging both into one dashboard

### What We Built

We implemented a 4-phase integration that connects real data → AI models → maps → alerts:

```
[Real Data]                [AI Models]              [User Interface]
  OpenWeatherMap ─────┐
  (Bogor + Jakarta    │   ┌──────────────┐        ┌──────────────────┐
   rainfall)          ├──▶│ LSTM (24h    │───────▶│ Auto-Predict UI  │
                      │   │ water level  │        │ Prediction Map   │
  Historical Replay ──┘   │ forecast)    │   ┌───▶│ Smart Alerts     │
  (TMA Manggarai          └──────────────┘   │    └──────────────────┘
   2020 data)                                │
                          ┌──────────────┐   │
  CCTV Frame URL ────────▶│ YOLOv8       │───┘
                          │ (flood       │
                          │  detection)  │
                          └──────────────┘
```

---

## Phase 0: Data Foundation

### Problem

noah.ai's data was fake:
- `/api/water-level` returned `{ message: "Data from Water Level API" }` — no actual data
- `/api/sensor-simulator` used `Math.sin() + Math.random()` for sensor readings
- The LSTM model needs **3 specific inputs**: `hujan_bogor` (mm), `hujan_jakarta` (mm), `tma_manggarai` (cm)

### Solution: Historical Replay + Real Rainfall

#### File: `app/api/water-level/route.ts`

**What it does:** Reads `ml-service/data/DATASET_FINAL_TRAINING.csv` — 744 rows of real hourly data from Manggarai flood gate (January 2020). Maps the current hour-of-day to a row in the dataset so the data "replays" realistically.

**How it works:**
```
Current time → (dayOfMonth * 24 + hour) % 744 → CSV row index
CSV row → { tma_manggarai, hujan_bogor, hujan_jakarta }
```

- Supports `?window=N` query param for returning N historical readings (for charts)
- Data is cached in memory after first load (no repeated file I/O)
- Returns risk level based on water level thresholds (AMAN < 400 < WASPADA < 700 < BAHAYA < 850 < CRITICAL)

**Response format:**
```json
{
  "current": {
    "water_level_cm": 64.9,
    "rainfall_bogor_mm": 1.3,
    "rainfall_jakarta_mm": 2.5,
    "risk_level": "AMAN",
    "source": "historical_replay"
  },
  "meta": {
    "dataset_size": 744,
    "replay_index": 48,
    "note": "Data replayed from real 2020 TMA Manggarai historical records"
  }
}
```

---

#### File: `app/api/sensor-simulator/route.ts`

**What it does:** Same historical CSV replay but adds minute-level interpolation between hourly readings. This makes the data feel "live" during demos — values gradually shift between readings instead of jumping every hour.

**How interpolation works:**
```
current_value = historical[hour] + (minute / 60) * (historical[hour+1] - historical[hour])
```

Falls back to old `Math.random()` approach if the CSV file is missing.

---

#### File: `app/api/rainfall-dual/route.ts` (NEW)

**What it does:** Fetches real-time rainfall from OpenWeatherMap for **both** Bogor and Jakarta simultaneously. This is required because the LSTM model was trained on separate rainfall columns for each city.

**How it works:**
```
GET api.openweathermap.org/data/2.5/weather?lat=-6.5971&lon=106.806  → Bogor rain
GET api.openweathermap.org/data/2.5/weather?lat=-6.2088&lon=106.8456 → Jakarta rain
```

Both calls run in `Promise.all()` for speed. OpenWeatherMap's `rain.1h` field only appears when it's actually raining — we default to `0` when absent (meaning no rain, not missing data).

**Response format:**
```json
{
  "rainfall_bogor": 2.1,
  "rainfall_jakarta": 0,
  "weather_bogor": { "temp": 28.5, "humidity": 85 },
  "weather_jakarta": { "temp": 31.2, "humidity": 72 },
  "timestamp": "2026-03-09T01:00:00.000Z"
}
```

---

## Phase 1: Auto-Feed Data → LSTM

### Problem

Users had to manually type rainfall and water level values into the prediction form. No connection between real data and the LSTM model.

### Solution: Auto-Predict Mode

#### File: `app/api/predict/route.ts` (MODIFIED)

**What changed:** Added a `mode` parameter to the POST body. When `mode=auto`:

1. Server calls `/api/water-level` to get current TMA Manggarai (cm)
2. Server calls `/api/rainfall-dual` to get Bogor + Jakarta rainfall (mm)
3. Server combines all 3 into a `PredictionRequest` and forwards to ML service
4. Response includes `input_data` showing exactly what values were used

**Data flow:**
```
Client POST { mode: "auto" }
  → Server fetches /api/water-level     → water_level_cm
  → Server fetches /api/rainfall-dual   → rainfall_bogor, rainfall_jakarta
  → Server POST to ML service /predict  → { water_level_cm, rainfall_mm, rainfall_bogor, rainfall_jakarta }
  → ML service runs LSTM + Physics Engine
  → Response with prediction + input_data
```

When `mode` is not `"auto"` (or omitted), the route works exactly as before — forwarding the client's manual input to ML.

---

#### File: `app/flood-predict/page.tsx` (MODIFIED)

**What changed:** Added three mode tabs instead of two:

| Tab | Description |
|-----|-------------|
| **⚡ Auto (Live)** | Default. One-click prediction using live data. Shows "Data Used" after prediction. |
| **Manual** | Original manual input form (rainfall Bogor, Jakarta, water level) |
| **Demo Scenario** | Predefined scenarios from the ML service |

The result card now shows a badge: `⚡ Auto (Live Data)` or `✏️ Manual Input`.

---

## Phase 2: Predictions on Map

### Problem

The flood map showed PetaBencana.id reports and evacuation points but no AI prediction data.

### Solution: Prediction Risk Layer

#### File: `supabase/migrations/20250309000000_create_predictions_detections.sql` (NEW)

Creates two Supabase tables:

**`predictions` table:**
| Column | Type | Purpose |
|--------|------|---------|
| `region_id` | TEXT | Monitoring point ID (e.g., `MANGGARAI_01`) |
| `prediction_cm` | FLOAT | Predicted water level |
| `risk_level` | TEXT | AMAN / WASPADA / BAHAYA / CRITICAL |
| `rainfall_bogor` | FLOAT | Input rainfall Bogor |
| `rainfall_jakarta` | FLOAT | Input rainfall Jakarta |
| `source` | TEXT | `manual`, `auto`, or `scenario` |

**`detections` table:**
| Column | Type | Purpose |
|--------|------|---------|
| `source_name` | TEXT | CCTV source identifier |
| `is_flooded` | BOOLEAN | YOLO detection result |
| `flood_probability` | FLOAT | Detection confidence |
| `objects_detected` | JSONB | Detected objects list |
| `location_lat/lon` | FLOAT | Camera coordinates |

Both tables have RLS enabled with public read + service insert policies.

---

#### File: `components/flood-map/PredictionLayer.tsx` (NEW)

**What it does:** A Leaflet `Circle` overlay component that renders color-coded risk zones at 4 Jakarta flood monitoring points.

**Monitoring points:**
| Point | Coordinates | Role |
|-------|-------------|------|
| Pintu Air Manggarai | -6.2088, 106.8456 | **Primary** — gets actual prediction |
| Istiqlal | -6.1703, 106.8317 | Secondary — affected zone |
| Pintu Air Karet | -6.2048, 106.8148 | Secondary — affected zone |
| Marina Ancol | -6.1256, 106.8417 | Secondary — affected zone |

**Color mapping:**
| Risk Level | Color | Circle Radius |
|------------|-------|---------------|
| CRITICAL | Red `#dc2626` | 3000m |
| BAHAYA | Orange `#ea580c` | 2500m |
| WASPADA | Amber `#d97706` | 2000m |
| AMAN | Green `#059669` | 1500m |

The primary point (Manggarai) shows a solid circle with prediction details in the popup. Secondary points show dashed circles at 70% radius. Auto-refreshes every 5 minutes.

---

#### File: `hooks/usePredictionData.ts` (NEW)

React hook that wraps the auto-predict API call with:
- Loading/error state management
- Optional polling interval (`usePredictionData(60000)` = every 60s)
- Manual `refetch()` function
- `lastUpdated` timestamp

---

#### File: `app/flood-map/page.tsx` (MODIFIED)

**What changed:**
- Added dynamic import for `PredictionLayer` (Leaflet component, SSR disabled)
- Added `showPredictionLayer` state (defaults to `true`)
- Renders `<PredictionLayer>` inside `<FloodMapClient>` children
- Added a toggle button in the bottom-right: "Prediction ON/OFF" with cyan highlight when active

---

## Phase 3: CCTV + Smart Alerts

### Problem

Visual verification required manual image upload. No automated CCTV scanning or cross-validated alerts.

### Solution: CCTV Scanner + Cross-Validation Engine

#### File: `app/api/cctv-scan/route.ts` (NEW)

**What it does:** Three-step CCTV analysis pipeline:

```
1. INPUT:  Receive CCTV source URL + metadata
2. FETCH:  Download image frame from CCTV URL
3. DETECT: Send frame to ML service /verify-visual (YOLO)
4. OUTPUT: Enriched detection result with source metadata
```

**Request format:**
```json
{
  "source_url": "https://example.com/cctv/manggarai/latest.jpg",
  "source_name": "Manggarai Flood Gate Camera",
  "location_lat": -6.2088,
  "location_lon": 106.8456
}
```

**Response includes:** YOLO detection results (`is_flooded`, `flood_probability`, `objects_detected`) plus source metadata and timestamp.

Handles errors gracefully: returns `502` if CCTV source is unreachable, ML service errors propagated with details.

---

#### File: `app/api/smart-alert/route.ts` (NEW)

**What it does:** The core cross-validation engine. Combines LSTM prediction + YOLO detection into a single confidence-scored alert.

**Algorithm:**

```
Step 1: Fetch LSTM prediction (auto mode)
Step 2: IF risk ≥ WASPADA AND cctv_source_url provided → run CCTV scan
Step 3: Calculate confidence score:
        LSTM contribution:
          CRITICAL → +0.50
          BAHAYA   → +0.40
          WASPADA  → +0.25
          AMAN     → +0.05
        YOLO contribution:
          is_flooded=true → +0.40 × flood_probability
Step 4: Map confidence to alert level:
          ≥ 0.70 → CRITICAL
          ≥ 0.50 → BAHAYA
          ≥ 0.30 → WASPADA
          < 0.30 → AMAN
Step 5: Generate Indonesian-language recommendation
```

**Response format:**
```json
{
  "alert_level": "BAHAYA",
  "confidence": 0.65,
  "sources": ["PREDICTION", "VISUAL"],
  "prediction": { "prediction_cm": 720, "risk_level": "BAHAYA" },
  "detection": { "is_flooded": true, "flood_probability": 0.82 },
  "recommendation": "⚠️ WASPADA TINGGI! Risiko banjir tinggi terdeteksi..."
}
```

---

## File Summary

| File | Type | Phase |
|------|------|-------|
| `app/api/water-level/route.ts` | Modified | 0 |
| `app/api/sensor-simulator/route.ts` | Modified | 0 |
| `app/api/rainfall-dual/route.ts` | New | 0 |
| `app/api/predict/route.ts` | Modified | 1 |
| `app/flood-predict/page.tsx` | Modified | 1 |
| `supabase/migrations/20250309000000_create_predictions_detections.sql` | New | 2 |
| `components/flood-map/PredictionLayer.tsx` | New | 2 |
| `hooks/usePredictionData.ts` | New | 2 |
| `app/flood-map/page.tsx` | Modified | 2 |
| `app/api/cctv-scan/route.ts` | New | 3 |
| `app/api/smart-alert/route.ts` | New | 3 |

---

## How to Run

```bash
# 1. Start ML Service (Terminal 1)
cd flood/ml-service
pip install -r requirements.txt
uvicorn src.main:app --port 8000

# 2. Start Next.js (Terminal 2)
cd flood
npm install
npm run dev

# 3. Open browser
# /flood-predict  → Auto Predict page
# /flood-map      → Map with prediction overlay
```

### API Testing (cURL)

```bash
# Water Level (historical replay)
curl http://localhost:3000/api/water-level?window=5

# Dual Rainfall (real OpenWeatherMap)
curl http://localhost:3000/api/rainfall-dual

# Auto Predict (combines water level + rainfall → LSTM)
curl -X POST http://localhost:3000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto"}'

# Smart Alert (cross-validates LSTM + YOLO)
curl -X POST http://localhost:3000/api/smart-alert \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Hackathon Fallback Strategy

Since we can't access live DSDA Jakarta water level sensors in time:

- **Water level:** Replayed from real 2020 historical data (honest, verifiable)
- **Rainfall:** Real-time from OpenWeatherMap (live API)
- **YOLO:** Works with any image upload (no dependency issues)
- **Pitch:** *"We use real weather data + historical water level patterns, with architecture ready for live DSDA sensors"*
