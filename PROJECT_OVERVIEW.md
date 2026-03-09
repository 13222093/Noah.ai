# 🌊 Hackathon 2025 — Flood Monitoring Projects Overview

This document provides an overview of three interconnected projects built for flood monitoring and early warning in Indonesia.

---

## 📋 Project Summary

| Project | Description | Tech Stack | Role |
|---------|-------------|------------|------|
| **noah.ai** | Real-time flood monitoring & weather tracking platform | Next.js, TypeScript, Supabase, Tailwind CSS | Frontend & Data Platform |
| **Jakarta-Floodnet** | AI-powered flood prediction & visual detection system | Python, FastAPI, TensorFlow (LSTM), YOLOv8 | ML & AI Backend |
| **noah.ai (flood)** | Unified platform merging noah.ai + Jakarta-Floodnet | Next.js + Python FastAPI ML service | Combined Production App |

---

## 1️⃣ noah.ai

**Repository:** `noah.ai/`  
**GitHub:** [MattYudha/noah.ai](https://github.com/mattyudha/noah.ai)

### What It Does

noah.ai is a comprehensive real-time flood monitoring and early warning platform for Indonesia. It provides weather data, water level tracking, pump status monitoring, disaster alerts, and interactive flood maps — all covering regions down to the sub-district (kecamatan) level.

### Key Features

- 🗺️ **Interactive Disaster Map** — Leaflet-based map with flood reports, evacuation points, and satellite view
- 🌦️ **Weather Forecast & History** — Real-time weather data from OpenWeatherMap (temperature, humidity, wind)
- 🚨 **Early Warning Alerts** — Multi-source disaster warnings with AI-powered analysis via Gemini API
- 📊 **Statistics Dashboard** — Historical flood data, rainfall graphs, and visual reports
- 🛠️ **Infrastructure Monitoring** — Real-time water levels and flood pump statuses
- 🌍 **Earthquake Info** — Live seismic data from BMKG
- 🌬️ **Air Quality Monitoring** — Pollution level tracking
- 💬 **Chatbot** — Interactive flood & weather information assistant
- 🔒 **Security** — Supabase Row Level Security, server-side input validation

### Tech Stack

- **Frontend:** Next.js 13+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **State Management:** React Query (@tanstack/react-query)
- **Backend:** Next.js API Routes + Supabase (PostgreSQL)
- **Maps:** Leaflet + Mapbox
- **AI:** Google Gemini API (for analysis & alerts)
- **Caching:** Upstash Redis (rate limiting + API caching)
- **Monitoring:** Sentry (error tracking & performance)
- **Testing:** Vitest
- **CI/CD:** GitHub Actions

---

## 2️⃣ Jakarta-Floodnet

**Repository:** `Jakarta-Floodnet/`  
**GitHub:** [13222093/Jakarta-Floodnet](https://github.com/13222093/Jakarta-Floodnet)

### What It Does

Jakarta FloodNet is an AI-powered flood early warning system designed to **predict** and **detect** flooding in Jakarta. It combines real-time sensor data with machine learning models to provide actionable insights for decision-makers.

### System Components

1. **API Gateway** — FastAPI backend handling data flow, model inference, and system logic
2. **AI Models:**
   - **LSTM (Long Short-Term Memory)** — Predicts flooding probability 24 hours in advance using rainfall & water level data
   - **YOLOv8** — Detects flooded areas and estimates flood extent from CCTV/satellite imagery
3. **Dashboard** — Streamlit-based UI for visualizing predictions, detections, and real-time data

### Key Features

- 📡 **Real-time Monitoring** — Tracks rainfall (mm) and water levels (cm) from monitoring points
- 🔮 **Flood Prediction** — 24-hour forecast with probability scores and risk levels (LOW / MEDIUM / HIGH)
- 📸 **Visual Flood Detection** — Auto-identifies flooded regions in images and calculates affected area
- 💡 **Actionable Recommendations** — Automated suggestions (e.g., "Initiate evacuation") based on risk assessment

### Tech Stack

- **Backend:** Python, FastAPI, Uvicorn
- **Frontend:** Streamlit, Plotly
- **ML/AI:** TensorFlow (LSTM), Ultralytics YOLOv8, OpenCV
- **Data Processing:** Pandas, NumPy

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/predict` | POST | Predict flooding probability from sensor data |
| `/detect` | POST | Detect flooded areas from images |
| `/health` | GET | System health check |
| `/metrics` | GET | Model performance metrics |

---

## 3️⃣ noah.ai (flood)

**Repository:** `flood/`  
**GitHub:** [jsndwrd/flood](https://github.com/jsndwrd/flood)

### What It Does

noah.ai is the **unified production platform** that merges noah.ai's frontend/monitoring capabilities with Jakarta-Floodnet's ML prediction and visual detection models into a single deployable application. This is the **main project** used for development and deployment.

### Architecture

```
noah.ai (flood/)
├── Next.js Frontend      ← noah.ai-based UI (maps, dashboard, alerts, weather)
└── ml-service/           ← Jakarta-Floodnet ML models (LSTM + YOLO via FastAPI)
```

### Key Features (Combined)

| Feature | Route | Source |
|---------|-------|--------|
| Flood Map | `/flood-map` | noah.ai |
| Flood Predict | `/flood-predict` | Jakarta-Floodnet (LSTM) |
| Visual Verify | `/visual-verify` | Jakarta-Floodnet (YOLO) |
| Sensor Data | `/sensor-data` | noah.ai |
| Dashboard | `/dashboard` | Both |
| Alerts | `/alerts` | noah.ai |
| Weather | `/weather` | noah.ai |

### How to Run

**Option A — Docker (Recommended)**
```bash
cd flood
docker-compose up --build
# Next.js → http://localhost:3000
# ML API  → http://localhost:8000
```

**Option B — Manual Setup**
```bash
# 1. Frontend
cd flood
npm install
cp .env.example .env.local   # Fill in API keys
npm run dev                   # → http://localhost:3000

# 2. ML Service
cd flood/ml-service
python -m venv venv
venv\Scripts\activate         # Windows
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENWEATHER_API_KEY` | Yes | Weather data |
| `GEMINI_API_KEY` | Yes | AI analysis |
| `ML_API_URL` | Yes | ML service URL (e.g., `http://localhost:8000`) |
| `ROBOFLOW_API_KEY` | For Visual Verify | YOLO detection |
| `UPSTASH_REDIS_REST_URL` | Optional | Caching & rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Redis auth |

---

## 🔗 How The Projects Connect

```
┌─────────────────────────────────────────────────────┐
│                  noah.ai (flood/)                   │
│                 Unified Platform                     │
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │      noah.ai         │  │  Jakarta-Floodnet    │ │
│  │   (Next.js Frontend) │  │  (Python ML Service) │ │
│  │                      │  │                      │ │
│  │  • Flood Maps        │  │  • LSTM Prediction   │ │
│  │  • Weather Data      │  │  • YOLO Detection    │ │
│  │  • Alerts & Dashboard│  │  • FastAPI Gateway    │ │
│  │  • Sensor Monitoring │  │  • Flood Analysis    │ │
│  │  • Supabase Backend  │  │                      │ │
│  └──────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- **noah.ai** = The original standalone frontend/monitoring platform
- **Jakarta-Floodnet** = The original standalone AI/ML prediction system
- **noah.ai (flood)** = The merged final product combining both → **use this for development**

---

## 👥 Team

| Role | Person | Responsibility |
|------|--------|----------------|
| Hacker | Ari Aziz | ML & Backend |
| Hacker | Naufarrel | Frontend & Ops |
| Hipster | Tiffcu | Design & Deck |
| Hustler | Dejet | Pitch & BPBD Relations |

---

## 📄 License

MIT License
