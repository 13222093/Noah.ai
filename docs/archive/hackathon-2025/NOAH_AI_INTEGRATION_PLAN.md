# 🌊 noah.ai — Full Integration Vision Plan (v2)

> **Goal:** Transform noah.ai from three side-by-side features into a **closed-loop flood intelligence system** where real data feeds Jakarta-Floodnet's AI models, and the results flow back into the platform for maps, alerts, and decision-making.

---

## ⚠️ Data Reality Check

Before planning, here's what we verified in the actual codebase:

### What's REAL in noah.ai
| Data | Source | Status |
|------|--------|--------|
| Weather (temp, humidity, wind) | OpenWeatherMap API | ✅ Real |
| Weather Forecast | OpenWeatherMap 5-day | ✅ Real |
| Flood/Disaster Reports | PetaBencana.id (crowdsourced) | ✅ Real |
| Earthquake Data | BMKG | ✅ Real |
| Air Quality | WAQI API | ✅ Real |

### What's FAKE in noah.ai
| Data | Actual Implementation | Problem |
|------|----------------------|---------|
| Water Level | Returns `{ message: "Data from Water Level API" }` — no actual data | ❌ Placeholder |
| Sensor Data | `Math.sin() + Math.random()` generating fake values | ❌ Fully simulated |
| Pump Status | Proxy with no confirmed real backend | ❌ Likely simulated |

### What the LSTM Model Actually Needs
Trained on `DATASET_FINAL_TRAINING.csv` with **3 columns**:

| Column | Unit | What It Is | Available from noah.ai? |
|--------|------|------------|------------------------|
| `hujan_bogor` | mm/hour | Rainfall at Bogor | ⚠️ Partially — need separate OpenWeatherMap call to Bogor coords |
| `hujan_jakarta` | mm/hour | Rainfall at Jakarta | ⚠️ Partially — need separate OpenWeatherMap call to Jakarta coords |
| `tma_manggarai` | cm | Water level at Pintu Air Manggarai flood gate | ❌ NOT available — needs government sensor data (PUPR/DSDA) |

---

## The Vision (Updated)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        noah.ai Platform                             │
│                                                                      │
│   ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐  │
│   │  DATA LAYER      │     │  AI LAYER         │     │  ACTION      │  │
│   │                  │────▶│  (Floodnet)       │────▶│  LAYER       │  │
│   │ • OpenWeatherMap │     │                   │     │              │  │
│   │   (Bogor rain)   │     │ • LSTM Prediction │     │ • Map Zones  │  │
│   │   (Jakarta rain) │     │ • YOLO Detection  │     │ • Auto Alert │  │
│   │ • DSDA/PUPR TMA  │     │ • Risk Scoring    │     │ • Evacuation │  │
│   │ • CCTV Feeds     │     │                   │     │ • Dashboard  │  │
│   │ • PetaBencana.id │     │                   │     │              │  │
│   └─────────────────┘     └──────────────────┘     └─────────────┘  │
│            │                       │                       │         │
│            └───────────────────────┴───────────────────────┘         │
│                         Supabase (shared state)                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Fix the Data Foundation (CRITICAL — Do First)

**Problem:** noah.ai's water level and sensor data are simulated. The LSTM can't work with `Math.random()`.

### 0A. Connect Real Water Level Data (tma_manggarai)

**Option A — DSDA Jakarta Open Data (Preferred)**
- Jakarta's DSDA (Dinas Sumber Daya Air) publishes water gate data
- Source: https://dsda.jakarta.go.id or Jakarta Smart City APIs
- Need: Pintu Air Manggarai water level in cm, updated hourly

**Option B — PUPR SDA API**
- Kementerian PUPR has flood gate monitoring
- Source: https://sih3.pu.go.id (Sistem Informasi Hidrologi)

**Option C — Simulated with realistic patterns (Hackathon fallback)**
- If real API access is blocked/slow, use historical `tma_2020.xlsx.csv` data (already in `ml-service/data/`) to create a realistic replay simulator instead of `Math.random()`
- This is honest for a demo — "we replay real historical patterns"

### Changes
- **`/api/water-level/route.ts`** — Replace placeholder with real DSDA API call or realistic historical replay
- **`/api/sensor-simulator/route.ts`** — Replace `Math.random()` with historical data replay

### 0B. Dual-Location Rainfall from OpenWeatherMap

**Problem:** noah.ai fetches weather for ONE location. LSTM needs Bogor AND Jakarta rainfall separately.

**Solution:** Create a new endpoint that fetches rain from both coordinates:

```
Bogor:   lat=-6.5971, lon=106.8060 → rain.1h (mm) → hujan_bogor
Jakarta: lat=-6.2088, lon=106.8456 → rain.1h (mm) → hujan_jakarta
```

### Changes
- **[NEW] `/api/rainfall-dual/route.ts`** — Fetches OpenWeatherMap for both Bogor and Jakarta coordinates, returns `{ rainfall_bogor: number, rainfall_jakarta: number }`
- **Note:** OpenWeatherMap's `rain.1h` field is only present when it's raining. Default to `0` when absent.

---

## Phase 1: Auto-Feed Real Data → LSTM

**Current State:** Users manually enter rainfall values on `/flood-predict`.  
**Target State:** LSTM auto-runs using real rainfall + water level data.

### Prerequisites
- Phase 0A (real water level) ✅
- Phase 0B (dual rainfall) ✅

### New Data Flow

```
/api/rainfall-dual → rainfall_bogor (mm), rainfall_jakarta (mm)
/api/water-level   → tma_manggarai (cm)
        ↓
  /api/predict?mode=auto (combines all 3 values)
        ↓
  ML Service /predict (LSTM + Physics Engine)
        ↓
  Result → Supabase `predictions` table
```

### Changes
- **`/api/predict/route.ts`** — Add `mode=auto`:
  1. Call `/api/rainfall-dual` to get both rainfall values
  2. Call `/api/water-level` to get current tma_manggarai
  3. Forward all 3 to ML service `/predict`
- **`/flood-predict/page.tsx`** — Add "Auto Predict (Live Data)" button
- **Supabase `predictions` table** — Store every prediction result

---

## Phase 2: Show Predictions on the Flood Map

**Current State:** Flood map shows PetaBencana.id reports and evacuation points.  
**Target State:** Map displays **color-coded risk zones** based on latest LSTM predictions.

### Changes
- **Supabase `predictions` table:**
  ```sql
  CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id TEXT NOT NULL,
    prediction_cm FLOAT,
    risk_level TEXT,          -- AMAN / WASPADA / BAHAYA / CRITICAL
    rainfall_bogor FLOAT,
    rainfall_jakarta FLOAT,
    water_level_cm FLOAT,
    alert_message TEXT,
    source TEXT DEFAULT 'auto', -- 'manual' or 'auto'
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- **[NEW] `components/map/PredictionLayer.tsx`** — Risk zone overlay for flood map
  - Green = AMAN, Yellow = WASPADA, Orange = BAHAYA, Red = CRITICAL
- **`/flood-map/page.tsx`** — Add "Prediction Layer" toggle
- **`/dashboard/page.tsx`** — Show latest prediction status card

---

## Phase 3: CCTV Integration → YOLO Auto-Detection

**Current State:** Users manually upload images on `/visual-verify`.  
**Target State:** System pulls from CCTV feeds and runs YOLO detection.

### CCTV Sources (Jakarta)
- Jakarta Smart City CCTV (public flood cameras)
- PetaBencana.id camera feeds
- Custom Raspberry Pi cameras at flood gates (future)

### Changes
- **Supabase tables:** `cctv_sources` (registry) + `detections` (results)
- **[NEW] `/api/cctv-scan/route.ts`** — Pull frame from CCTV → send to YOLO → store result
- **`/visual-verify/page.tsx`** — Add CCTV source selector dropdown
- **Scheduled scanning** — Run every 15-30 min, or trigger when LSTM predicts HIGH risk

---

## Phase 4: Cross-Validation & Smart Alerts

**Current State:** Alerts come from PetaBencana.id and Gemini analysis of external data.  
**Target State:** Alerts generated by combining LSTM predictions + YOLO detections.

### Cross-Validation Logic

```
IF LSTM predicts BAHAYA/CRITICAL
   AND YOLO detects flooding (probability > 0.7)
THEN → HIGH CONFIDENCE alert
     → Gemini generates actionable recommendation
     → Nearest evacuation point suggested
```

### Changes
- **[NEW] `/api/smart-alert/route.ts`** — Cross-validate LSTM + YOLO, generate alert
- **`/alerts/page.tsx`** — Show alert source: `PREDICTION`, `VISUAL`, `CROSS-VALIDATED`

---

## Phase 5: Prediction History & Accountability

**Current State:** No prediction history stored.  
**Target State:** Full audit trail for model credibility.

### Changes
- **`/statistics` pages** — Add "Prediction Accuracy" section
- **Compare predictions vs actuals** — Did the LSTM get it right?
- **Export to CSV** — For BPBD reporting

---

## Implementation Priority (Updated)

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| **Phase 0: Fix Data Foundation** | 🟡 Medium (2–3 days) | Critical | **P0 — Without this, nothing works** |
| Phase 1: Auto-Feed → LSTM | 🟢 Low (1–2 days) | High | **P0 — After Phase 0** |
| Phase 2: Predictions on Map | 🟡 Medium (2–3 days) | High | **P1** |
| Phase 3: CCTV Integration | 🟡 Medium (3–4 days) | Very High | **P1** |
| Phase 4: Cross-Validation | 🟢 Low (1–2 days) | Very High | **P2** |
| Phase 5: History | 🟢 Low (1–2 days) | Medium | **P2** |

### Recommended Order

```
Week 1:  Phase 0 (fix data) + Phase 1 (auto-predict)
Week 2:  Phase 2 (map) + Phase 3 (CCTV)
Week 3:  Phase 4 (smart alerts) + Phase 5 (history)
```

---

## Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `app/api/rainfall-dual/route.ts` | Fetch rain from Bogor + Jakarta coords |
| `app/api/predict/auto/route.ts` | Auto-predict using live data |
| `app/api/cctv-scan/route.ts` | CCTV frame → YOLO detection |
| `app/api/smart-alert/route.ts` | Cross-validated alert generation |
| `components/map/PredictionLayer.tsx` | Risk zone overlay for map |
| `components/dashboard/PredictionCard.tsx` | Prediction status widget |
| `hooks/usePredictionData.ts` | Hook for prediction data |
| `supabase/migrations/predictions.sql` | Predictions table |
| `supabase/migrations/detections.sql` | Detections + CCTV tables |

### Modified Files
| File | Change |
|------|--------|
| `app/api/water-level/route.ts` | Replace placeholder with real DSDA data or historical replay |
| `app/api/sensor-simulator/route.ts` | Replace Math.random() with historical data replay |
| `app/flood-predict/page.tsx` | Add "Auto Predict" mode |
| `app/flood-map/page.tsx` | Add prediction risk layer |
| `app/dashboard/page.tsx` | Add prediction + detection cards |
| `app/alerts/page.tsx` | Show alert source and confidence |
| `app/visual-verify/page.tsx` | Add CCTV source selector |

---

## Hackathon Fallback Strategy

If you can't get real DSDA/PUPR water level APIs in time:

1. **Use historical replay** from `ml-service/data/tma_2020.xlsx.csv` (real 2020 data, replayed as if live)
2. **OpenWeatherMap rainfall** is real and works today
3. **YOLO works** with any uploaded image — no dependency issues
4. **Pitch it honestly:** "We use real weather data + historical water level patterns, with the architecture ready to plug into live DSDA sensors"

---

## The Pitch (Updated)

> *"noah.ai predicts floods 24 hours ahead using LSTM models fed by real-time rainfall from OpenWeatherMap and water level data from Jakarta's flood gates. It cross-validates predictions with YOLO-powered CCTV flood detection to generate high-confidence alerts with evacuation routing — all through one unified dashboard."*
