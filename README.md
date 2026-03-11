<div align="center">

# 🌊 noah.ai

**AI-Powered Flood Intelligence Platform for ASEAN**

Real-time flood monitoring, LSTM prediction, YOLO visual verification, and Gemini-powered analysis — built as a unified command center.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green?logo=python)](https://python.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Pages](#pages)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Design System](#design-system)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Overview

**noah.ai** is a unified flood intelligence platform that merges two systems:

- **Floodzy** — Jakarta flood monitoring frontend with region-based weather, evacuation routing, and alert management
- **Jakarta-Floodnet** — ML backend with LSTM-based flood prediction and YOLO visual verification

The result is a **command center dashboard** with a map-centric dark theme layout, real-time alerts, AI chatbot, and integrated ML services — targeting disaster response teams across ASEAN.

### Why noah.ai?

| Problem | Solution |
|---|---|
| Flood warnings arrive too late | LSTM predicts water levels 6 hours ahead |
| Manual flood verification is slow | YOLO visual detection from CCTV/photos |
| No unified view for responders | Command center dashboard with all data in one place |
| Rural communities lack internet | SMS alert system via Twilio |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Command  │ │  Flood   │ │   ML     │ │    Region        │ │
│  │ Center   │ │   Map    │ │  Pages   │ │    Selector      │ │
│  │ (Dashboard)│ │ (Leaflet)│ │ (Predict/│ │ (Province →      │ │
│  │          │ │          │ │  Verify) │ │  District)       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │            │                 │           │
│  ┌────▼─────────────▼────────────▼─────────────────▼─────────┐ │
│  │              Next.js API Routes (/api/*)                   │ │
│  │  dashboard · alerts · flood-reports · predict · chatbot    │ │
│  │  ml-health · cctv-scan · evacuation · weather · sms       │ │
│  └────┬──────────────┬───────────────────────┬───────────────┘ │
└───────┼──────────────┼───────────────────────┼─────────────────┘
        │              │                       │
   ┌────▼────┐   ┌─────▼─────┐          ┌─────▼──────┐
   │ Supabase│   │ ML Service│          │  External  │
   │  (DB +  │   │ (FastAPI) │          │   APIs     │
   │  Auth)  │   │           │          │            │
   └─────────┘   │ • LSTM    │          │ • OpenWeather│
                 │ • YOLO    │          │ • Gemini AI │
                 │ • Physics │          │ • Roboflow  │
                 │   Fallback│          │ • BMKG      │
                 └───────────┘          │ • Twilio    │
                                        └────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router, server components |
| **TypeScript 5.2** | Type safety |
| **Tailwind CSS 3.3** | Utility-first styling with custom Command Center design tokens |
| **Leaflet + react-leaflet** | Interactive flood maps with prediction overlays |
| **Zustand** | Global state management (selected location, map bounds) |
| **Framer Motion** | Animations and transitions |
| **Radix UI** | Accessible component primitives (Dialog, Popover, Drawer, etc.) |
| **React Hook Form + Zod** | Form validation (flood reports, settings) |
| **Recharts** | Data visualization and charts |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| **Next.js API Routes** | Server-side endpoints for weather, alerts, dashboard widgets |
| **Supabase** | PostgreSQL database + auth + real-time subscriptions |
| **Google Gemini AI** | Chatbot intelligence + flood analysis |
| **Twilio** | SMS alerts for rural flood warnings |

### ML Service (Python)
| Technology | Purpose |
|---|---|
| **FastAPI** | ML API server |
| **TensorFlow/Keras** | LSTM flood prediction model |
| **Roboflow** | YOLO visual flood verification |
| **Physics Engine** | Fallback when LSTM is unavailable |

---

## Features

### 🖥️ Command Center Dashboard
- **Map-centric layout** — Leaflet flood map fills the main area, sidebar for contextual data
- **Dark theme** — Command center design tokens (`cc-bg`, `cc-surface`, `cc-elevated`) with 4-tier severity colors
- **NavRail** — 6-item navigation: Command, Alerts, Data, Weather, AI Tools, More
- **StatusBar** — Live KPIs: active alerts, flood zones, total regions, people at risk, ML health
- **PanelSwitcher** — Swappable sidebar panels: Alert Feed, Sensor Data, Weather, AI Tools
- **Location Picker** — Province → Regency → District selector, overlaid on map
- **Fullscreen map** — Desktop: Escape key toggle. Mobile: Drawer with header
- **⌘K Command Menu** — Quick keyboard-driven navigation

### 🤖 AI Integration
- **Noah AI Chatbot** — Gemini-powered assistant with geolocation awareness
- **LSTM Flood Prediction** — 6-hour water level forecasting (falls back to physics engine)
- **YOLO Visual Verification** — Upload photos for AI flood detection via Roboflow
- **Gemini Analysis** — Natural language flood situation analysis

### 🗺️ Flood Mapping
- **Interactive Leaflet Map** — Flood-prone area overlays, weather stations, prediction layers
- **Flood Report Submission** — Zod-validated form → `POST /api/flood-reports`
- **Evacuation Routing** — Leaflet Routing Machine → Google Maps navigation
- **PredictionLayer** — LSTM risk zones rendered on map, auto-refreshes every 5 minutes

### 📱 Mobile Experience
- **Bottom tab bar** — 6-item native-style navigation
- **Fullscreen map drawer** — Swipe-up drawer with map + close button
- **Responsive panels** — Touch-optimized alert feed and data views

### 📡 Real-Time Data
- **Weather dashboard** — OpenWeatherMap current conditions + forecast + AQI
- **Water level monitoring** — 100+ sensor posts with status (Normal/Waspada/Siaga/Bahaya)
- **Pump station status** — Infrastructure monitoring with operational/maintenance/offline states
- **BMKG earthquake data** — Latest seismic activity from Indonesian Met Agency

### 📲 SMS Alerts
- **Twilio integration** — SMS flood warnings for rural communities without internet
- **Subscription page** — Phone number registration at `/sms-subscribe`

---

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Command Center — map + alerts + panels |
| `/flood-map` | Interactive flood map with report submission |
| `/flood-predict` | LSTM water level prediction |
| `/visual-verify` | YOLO image analysis for flood detection |
| `/alerts` | Full disaster alert listing |
| `/evacuation` | Evacuation locations + Google Maps routing |
| `/sensor-data` | Real-time sensor data simulator |
| `/statistics` | Flood statistics and analytics |
| `/current-weather` | Current weather conditions |
| `/weather-forecast` | Weather forecast |
| `/education` | Flood preparedness education |
| `/settings` | App preferences and theme switching |
| `/sms-subscribe` | SMS alert subscription |
| `/cctv-simulation` | CCTV monitoring simulation |
| `/contact` | Contact and information |
| `/data-source` | Data source attribution |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10–3.12 (for ML service; 3.13 has TensorFlow issues on Windows)
- **Docker** & Docker Compose (optional)

### Option 1: Docker (Recommended)

```bash
docker-compose up --build
```

- **Frontend:** http://localhost:3000
- **ML API:** http://localhost:8000

### Option 2: Manual Setup

#### 1. Frontend

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API keys (see Environment Variables)
npm run dev
```

Open http://localhost:3000

#### 2. ML Service

```bash
cd ml-service
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Set `ML_API_URL=http://localhost:8000` in `.env.local`.

### Windows Notes

<details>
<summary>TensorFlow long path fix</summary>

If `pip install` fails with path length errors:

1. **Enable long paths** (run PowerShell as Administrator):
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```
   Restart your computer.

2. **Or use a shorter venv path:**
   ```powershell
   python -m venv C:\ml-venv
   C:\ml-venv\Scripts\activate
   cd ml-service
   pip install -r requirements.txt
   ```
</details>

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `OPENWEATHER_API_KEY` | ✅ | OpenWeatherMap API key |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `ML_API_URL` | ✅ | ML service URL (e.g. `http://localhost:8000`) |
| `ROBOFLOW_API_KEY` | For YOLO | Roboflow API key for visual verification |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | For SMS | Twilio sender phone number |
| `UPSTASH_REDIS_REST_URL` | Optional | Redis for rate limiting/caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Redis token |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |

---

## Project Structure

```
flood/
├── app/                          # Next.js App Router pages
│   ├── api/                      # API routes (dashboard, alerts, predict, chatbot, etc.)
│   ├── dashboard/                # Command Center page
│   ├── flood-map/                # Interactive flood map
│   ├── flood-predict/            # LSTM prediction page
│   ├── visual-verify/            # YOLO verification page
│   ├── evacuation/               # Evacuation routing
│   ├── globals.css               # Design tokens + Command Center theme
│   └── layout.tsx                # Root layout with providers
├── components/
│   ├── layout/                   # CommandCenterView, NavRail, StatusBar, AppShell
│   ├── panels/                   # PanelSwitcher, DataPanel, WeatherPanel, AIToolsPanel
│   ├── contexts/                 # StatsContext, AlertCountContext
│   ├── map/                      # FloodMap, WeatherInsightMap
│   ├── flood-map/                # PetaBanjirClient, ReportFloodModal, PredictionLayer
│   ├── region-selector/          # RegionDropdown (Province → District)
│   ├── modals/                   # LocationPickerModal
│   └── ui/                       # Radix-based primitives (Button, Dialog, Drawer, etc.)
├── hooks/                        # useWeatherData, useDisasterData, useRegionData, useMediaQuery
├── lib/                          # utils, store (Zustand), api client, mock data, constants
├── ml-service/                   # Python FastAPI ML service
│   ├── src/main.py               # API endpoints (/predict, /verify-visual, /health)
│   ├── models/                   # LSTM model weights
│   └── requirements.txt          # Python dependencies
├── public/                       # Static assets
├── types/                        # TypeScript type definitions
└── src/context/                  # LanguageContext (i18n)
```

---

## Design System

The command center uses custom CSS custom properties for a cohesive dark theme:

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--cc-bg` | `#f8fafc` | `#0a0e1a` | Page background |
| `--cc-surface` | `#ffffff` | `#111827` | Card/panel backgrounds |
| `--cc-elevated` | `#f1f5f9` | `#1a2236` | Elevated surfaces |
| `--cc-cyan` | `#0891b2` | `#00e5ff` | Primary accent |
| `--cc-critical` | `#ff1744` | `#ff1744` | Danger/critical status |
| `--cc-warning` | `#ff3d00` | `#ff3d00` | Warning status |
| `--cc-caution` | `#ff9100` | `#ff9100` | Caution status |
| `--cc-safe` | `#00e676` | `#00e676` | Safe/normal status |

Themes available: **Light**, **Dark**, **System**, **High Contrast**

---

## Known Limitations

| Area | Status | Detail |
|---|---|---|
| LSTM Prediction | ⚠️ Falls back to physics engine | Model requires 62-feature preprocessing pipeline — currently sends simplified input |
| CCTV Monitoring | ⚠️ Placeholder | All channels show offline — no live CCTV sources configured |
| Infrastructure Status | ⚠️ Static mock data | Labeled as "(Placeholder)" in UI |
| Flood Reports | ✅ Frontend works | POSTs to `/api/flood-reports` — backend storage via Supabase |

---

## UN SDG Alignment

noah.ai aligns with:
- **SDG 9** — Industry, Innovation & Infrastructure
- **SDG 11** — Sustainable Cities & Communities
- **SDG 13** — Climate Action
- **SDG 17** — Partnerships for the Goals

---

## License

MIT
