# Noah.ai — Complete Feature Documentation

> **Purpose:** This document catalogs every feature, page, and integration in the current Noah.ai (`flood/`) codebase. It is intended as a reference before a full UI/UX refactor into a "Command Center" design.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Global Infrastructure](#2-global-infrastructure)
3. [Landing Page](#3-landing-page)
4. [Dashboard](#4-dashboard)
5. [Flood Map (Peta Banjir)](#5-flood-map-peta-banjir)
6. [Weather Forecast (Prakiraan Cuaca)](#6-weather-forecast-prakiraan-cuaca)
7. [Current Weather (Cuaca Sekarang)](#7-current-weather-cuaca-sekarang)
8. [Alerts & Warnings (Peringatan)](#8-alerts--warnings-peringatan)
9. [Flood Report (Lapor Banjir)](#9-flood-report-lapor-banjir)
10. [Flood Prediction — LSTM](#10-flood-prediction--lstm)
11. [Visual Verification — YOLO](#11-visual-verification--yolo)
12. [CCTV Simulation](#12-cctv-simulation)
13. [Evacuation Info](#13-evacuation-info)
14. [Sensor Data](#14-sensor-data)
15. [Statistics](#15-statistics)
16. [SMS Subscribe](#16-sms-subscribe)
17. [Education Hub](#17-education-hub)
18. [Settings](#18-settings)
19. [Supporting Pages](#19-supporting-pages)
20. [API Routes (Backend)](#20-api-routes-backend)
21. [Education Sub-Pages](#21-education-sub-pages)
22. [Bundled ML Service](#22-bundled-ml-service-ml-service)
23. [Database Schema (Supabase)](#23-database-schema-supabase)
24. [Custom Hooks (Data Layer)](#24-custom-hooks-data-layer)
25. [Infrastructure Utilities](#25-infrastructure-utilities)
26. [Type Definitions](#26-type-definitions-types)
27. [Undocumented Components](#27-undocumented-components)
28. [Static HTML Pages](#28-static-html-pages-public)
29. [Instrumentation & Monitoring](#29-instrumentation--monitoring)
30. [Jakarta-Floodnet Features (To Integrate)](#30-jakarta-floodnet-features-to-integrate)
31. [User Flow Diagram](#31-user-flow-diagram)

---

## 1. Architecture Overview

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Radix UI (shadcn/ui), Framer Motion |
| Maps | Leaflet + React-Leaflet |
| State | React state, React Query |
| Database | Supabase (PostgreSQL) |
| AI/ML | Google Gemini API, LSTM model, YOLOv8 (via Jakarta-Floodnet API) |
| SMS | Twilio |
| Monitoring | Sentry |
| PWA | next-pwa, Service Worker |
| i18n | Custom context (`LanguageContext`) — EN/ID |
| Caching | Upstash Redis |
| Auth | None (public app) |

### Layout Structure

```
RootLayout (app/layout.tsx)
├── ReactQueryProvider
├── ThemeProvider (dark/light)
├── AlertCountProvider (real-time badge count)
├── LanguageProvider (EN/ID)
├── ClientLayoutWrapper
│   ├── Sidebar (hidden on landing, contact, flood-map)
│   └── Main Content Area
└── Toaster (react-hot-toast)
```

**Sidebar Navigation Items (12):**
| # | Label | Route | Icon |
|---|---|---|---|
| 1 | Dashboard | `/` | LayoutDashboard |
| 2 | Peta Banjir | `/flood-map` | Map |
| 3 | Prakiraan Cuaca | `/weather-forecast` | CloudSun |
| 4 | Peringatan | `/alerts` | AlertTriangle |
| 5 | Lapor Banjir | `/flood-report` | FileWarning |
| 6 | Prediksi LSTM | `/flood-predict` | BrainCircuit |
| 7 | Verifikasi Visual | `/visual-verify` | ScanEye |
| 8 | Simulasi CCTV | `/cctv-simulation` | Video |
| 9 | Info Evakuasi | `/evacuation` | Shield |
| 10 | Data Sensor | `/sensor-data` | Database |
| 11 | Statistik | `/statistics` | BarChart3 |
| 12 | Tentang | `/about.html?mode=read` | HelpCircle |

**Bottom Bar Items:** SMS Subscribe, Settings, AI Chatbot

---

## 2. Global Infrastructure

### Theme System
- Dark/light mode toggle via `ThemeProvider`
- Persisted in localStorage
- CSS variables-based color system

### i18n (Internationalization)
- **Languages:** Indonesian (id), English (en)
- **Files:** `src/i18n/en.ts`, `src/i18n/id.ts`
- **Context:** `LanguageContext` with `t()` helper and `lang` state
- Language switcher component in sidebar/header

### PWA (Progressive Web App)
- Service worker at `public/sw.js`
- Manifest with icons (192×192, 512×512)
- Offline capability for cached assets

### Alert Count System
- `AlertCountContext` provides real-time alert badge count
- Displayed on sidebar navigation badge

---

## 3. Landing Page

**Route:** `/` → rewrites to `public/landing.html`  
**Type:** Static HTML (not React)

### Features
- Full-screen animated intro with Noah.ai branding
- "Enter Dashboard" CTA button
- Auto-redirect on return visits (via `localStorage.getItem('noah.ai_seen')`)
- Sets `noah.ai_seen` in localStorage on first CTA click

### User Flow
```
First Visit:  Landing Page → Click "Enter" → Dashboard (sets localStorage)
Return Visit: Landing Page → Auto-redirect → Dashboard
```

---

## 4. Dashboard

**Route:** `/dashboard`  
**File:** `app/dashboard/page.tsx` (Server Component) → `DashboardClientPage` (Client)

### Features

#### Statistics Cards (Top Row)
- **Total Regions** — Count of unique monitored areas
- **Active Alerts** — Number of current real-time alerts
- **Flood Zones** — Water level posts with non-normal status
- **People at Risk** — Estimated affected population (calculated)

#### Water Level Monitor
- Real-time water level posts (mock data: 100 posts)
- Status indicators: Normal / Siaga / Bahaya
- Sortable/filterable list

#### Pump Status Monitor
- Infrastructure pump status across Jakarta (mock: 100 pumps)
- Operating / Maintenance / Offline states

#### Real-Time Alert Feed
- Live alert cards with severity levels (High / Medium / Low)
- Location, timestamp, reason, affected areas
- Animated card transitions

#### BMKG Earthquake Widget
- Fetches latest earthquake data from `fetchBmkgLatestQuake()`
- Magnitude, depth, location, coordinates
- ISR with 5-minute revalidation

#### AI Chat (Gemini)
- Floating chatbot button
- Conversational AI via Google Generative AI API
- Flood-specific context and knowledge

### Data Sources
- Mock generators: `generateMockWaterLevels()`, `generateMockPumpStatus()`
- Constants: `FLOOD_MOCK_ALERTS`
- Live: BMKG API

---

## 5. Flood Map (Peta Banjir)

**Route:** `/flood-map`  
**File:** `app/flood-map/page.tsx` (Client Component, 465 lines)

### Features

#### Interactive Map (Full-Screen Leaflet)
- Dark-themed CartoDB tiles
- Flood report markers with severity colors
- Evacuation point markers
- User geolocation marker
- Evacuation route polyline
- **Prediction heatmap overlay** (toggleable `PredictionLayer`)
- Fullscreen toggle (browser Fullscreen API)

#### Search & Filters
- `MapSearchControl` — Location search bar
- `MapActionsControl` — Filter panel:
  - Severity filter: Low / Moderate / High
  - Time range: 24h / 3 days / All
  - Status: All / Verified only
- Filter state syncs with map markers in real-time

#### Bottom Carousel
- Horizontal scrollable `FloodReportCard` carousel
- Cards show: location, water level (cm), timestamp, trend (rising/falling/stable), severity
- Click card → map zooms to report
- Syncs selection between carousel and map markers

#### Evacuation Routing
- "Find Nearest Evacuation" button
- Uses browser Geolocation API
- Haversine distance calculation to find nearest evacuation point
- Draws route polyline on map

#### Community Flood Reporting
- "Report Flood" button opens report modal
- Pin location on map, submit report with details

### Data
- 5 mock flood reports with positions in Jakarta
- 2 mock evacuation points

---

## 6. Weather Forecast (Prakiraan Cuaca)

**Route:** `/weather-forecast`  
**File:** `app/weather-forecast/page.tsx` (997 lines)

### Features

#### Location Selection
- Search by city name (OpenWeatherMap Geocoding API)
- "Use My Location" (browser Geolocation + reverse geocoding)
- RegionDropdown for Jakarta sub-districts

#### Current Weather Display
- Temperature, feels-like, description, weather icon
- Humidity, wind speed, pressure, visibility
- Sunrise/sunset times
- "Live" badge indicator

#### 5-Day Forecast
- Daily cards with date, icon, description, high/low temps
- Data from OpenWeatherMap 2.5/forecast endpoint

#### Weather Map
- Interactive Leaflet map with weather overlays
- Toggleable layers: Clouds, Precipitation, Temperature, Wind, Pressure
- Map center follows selected location
- Fullscreen toggle

#### API Status
- Online/Offline badge based on API key availability
- Refresh button to re-fetch data

### APIs
- `/api/weather` (internal route → OpenWeatherMap)
- OpenWeatherMap Geocoding (direct + reverse)

---

## 7. Current Weather (Cuaca Sekarang)

**Route:** `/current-weather`  
**File:** `app/current-weather/page.tsx` (36 lines)

### Features
- Simple dialog popup with weather info
- Uses `WeatherPopupContent` component
- Auto-opens on page load (`defaultOpen={true}`)
- Quick access/shortcut page for weather data

---

## 8. Alerts & Warnings (Peringatan)

**Route:** `/alerts`  
**File:** `app/alerts/page.tsx` (371 lines)

### Features

#### Statistics Overview (4 cards)
- Total Alerts, High Level, Medium Level, Low Level
- Animated entry with stagger effect

#### Real-Time Alert Simulation
- Pool of 15 mock alerts from Jakarta water monitoring points
- Auto-updates every 60 seconds: replaces 2-3 random alerts with new ones
- Sorted by most recent timestamp

#### Alert Cards
- Severity badge (High/Medium/Low with color coding)
- Location, timestamp, reason
- Affected areas chips
- Estimated population at risk
- Severity score (out of 10)

#### AI Analysis (Gemini)
- Click alert → "View Detail" triggers Gemini analysis
- Shows detailed explanation panel with:
  - Location context
  - Risk factors
  - Affected regions summary

#### News Tab
- Second tab: "Berita & Laporan"
- Fetches mock news reports from real Indonesian news sources
- Gemini-powered news summarization
- Auto-refreshes every 5 minutes
- Links to original source

---

## 9. Flood Report (Lapor Banjir)

**Route:** `/flood-report`  
**File:** `app/flood-report/page.tsx` (740 lines)

### Features

#### Flood Report Form
- **Map Picker** (Leaflet): Click to set coordinates, drag marker
- **Location Search**: Nominatim/OpenStreetMap geocoding
- **Water Level Selection**: 5 levels with radio buttons
  - Semata Kaki (<30cm), Selutut (30-50cm), Sepaha (50-80cm), Sepusar (80-120cm), >Sepusar (>120cm)
- **Photo Upload**: Drag & drop or click, with image preview
- **Description**: Textarea for flood details
- **Reporter Info**: Name + contact number
- **Zod Validation**: Client-side form validation with error messages

#### ML Prediction on Submit
- Calls `/api/predict` with payload derived from form data
- Sends: latitude, longitude, water level, rainfall, temperature, humidity, etc.
- Returns: risk_label (HIGH/MED/LOW) + probability percentage
- Shows prediction result in success message

#### Supabase Integration
- Uploads photo to `laporan-banjir` storage bucket
- Inserts report to `laporan_banjir` table with:
  - All form fields + photo URL
  - ML prediction risk and probability

#### Sidebar Info
- Current time display
- Reporting guidelines (4 steps)
- Emergency contacts (BPBD: 164, Damkar: 113, Polri: 110)

---

## 10. Flood Prediction — LSTM

**Route:** `/flood-predict`  
**File:** `app/flood-predict/page.tsx` (364 lines)

### Features

#### Three Prediction Modes
1. **Auto (Live)**: Fetches live water level + real-time rainfall data, feeds to LSTM model
2. **Manual**: User inputs rainfall Bogor (mm), rainfall Jakarta (mm), water level (cm)
3. **Demo Scenario**: Pre-defined scenarios loaded from `/api/scenarios`

#### Prediction Result Panel
- Predicted water level (cm)
- Risk level badge: AMAN (green) / WASPADA (amber) / BAHAYA (orange) / CRITICAL (red)
- Recommendation/alert message
- Input data display (for Auto mode)
- Mode used indicator (Auto vs Manual)

#### ML Health Indicator
- LSTM model status: Ready / Offline
- YOLO model status: Ready / Offline
- Fetched from `/api/ml-health`

### APIs
- `/api/predict` (POST) — LSTM prediction
- `/api/scenarios` (GET) — List/load scenarios
- `/api/scenarios/:id` (POST) — Run scenario prediction
- `/api/ml-health` (GET) — Model status check

---

## 11. Visual Verification — YOLO

**Route:** `/visual-verify`  
**File:** `app/visual-verify/page.tsx` (226 lines)

### Features
- **Image Upload**: Drag & drop or click to select
- **Image Preview**: Shows uploaded image before analysis
- **YOLO Analysis**: Sends image to `/api/verify-visual` for flood detection
- **Results**:
  - Flood detected / not detected indicator
  - Flood probability bar (0-100%)
  - Detected objects list (chips)
- **Reset**: Clear results and upload new image

### API
- `/api/verify-visual` (POST, multipart/form-data) → YOLOv8 inference

---

## 12. CCTV Simulation

**Route:** `/cctv-simulation`  
**File:** `app/cctv-simulation/page.tsx` (92 lines)

### Features
- **4-Channel Grid**: Simulated CCTV monitoring layout (2×2 grid)
- **Per-Channel Status**: Online/Offline indicator
- **Playback Controls**: Play/Pause/Refresh buttons
- **Placeholder**: Currently shows "No video source" — designed for integration with real CCTV feeds and YOLO overlay

### Status
> ⚠️ **Placeholder page** — Requires video source URLs for live YOLO analysis. Ready for Jakarta-Floodnet integration.

---

## 13. Evacuation Info

**Route:** `/evacuation`  
**File:** `app/evacuation/page.tsx` (451 lines)

### Features

#### Statistics Cards
- Total Locations, Remaining Capacity, Almost Full Count, Live Update status

#### Interactive Map
- Dark CartoDB tile map centered on Jakarta
- Custom evacuation markers (SVG icons)
- Popup with name + detail link on marker click

#### Location List (Sidebar)
- Scrollable list with:
  - Name, address, capacity (current/total)
  - Status badge: Available / Almost Full / Full
  - Color-coded capacity indicator
- Status legend overlay

#### Location Detail Modal
- Operational status (Open/Closed/Full)
- Capacity bar with percentage fill
- Essential services grid: Clean Water, Electricity, Medical Support
- Facilities chips
- Contact info (person name + phone)
- Last updated timestamp
- Verified by info
- **"Navigate in Google Maps"** button (opens external link)

### API
- `/api/evacuation` (GET) — Returns evacuation locations from database

---

## 14. Sensor Data

**Route:** `/sensor-data`  
**File:** `app/sensor-data/page.tsx` (62 lines, Server Component)

### Features
- **Statistics Dashboard**: Lazy-loaded overview component
- **Sensor Data Table**: Fetches from Supabase `laporan_banjir` table
  - Ordered by `created_at` descending
  - ISR with 30-second revalidation
- **Error Handling**: Shows error state with message if Supabase fetch fails
- **Skeleton Loading**: Both stats and table show skeleton animations during load

### Data Source
- Supabase `laporan_banjir` table (same as flood reports)

---

## 15. Statistics

**Route:** `/statistics`  
**File:** `app/statistics/page.tsx` + sub-components

### Features
- **Statistical Overview**: Charts and data visualization
  - Time-based chart data generation (`generateChartData`)
  - Historical incident tracking (`HistoricalIncident` type)
  - Stat cards with key metrics
- **Historical Data**: Past flood incidents with timestamps
- **Filter & Download**: Data filtering and export functionality
- **Gemini Chat Section**: AI-powered data analysis chat

### Sub-Components
- `StatistikOverview` — Main chart and stats view
- `StatistikHistorical` — Historical incident timeline
- `GeminiChatSection` — AI analysis chat panel

---

## 16. SMS Subscribe

**Route:** `/sms-subscribe`  
**File:** `app/sms-subscribe/page.tsx` (383 lines)

### Features

#### Purpose
- SMS-based flood alerts for **rural communities without smartphones or internet**
- Works on all phone types (feature phones included)

#### Registration Form
- **Phone Number**: International format (+62)
- **Name**: Optional
- **Region Selection**: 4 monitoring points
  - Pintu Air Manggarai, Istiqlal, Pintu Air Karet, Marina Ancol
- **Language**: Indonesian / English toggle

#### SMS Preview
- Shows example SMS message in selected language
- Format: Warning level, location, water level, action recommendation

#### Flow: How It Works
1. User registers phone + region
2. AI (LSTM + YOLO) continuously monitors data
3. When risk level reaches WASPADA/BAHAYA/KRITIS → auto-sends SMS

#### Success State
- Confirmation message with registered info
- Instructions for unsubscribing (reply STOP)
- Links to register another number or return to dashboard

#### Privacy
- Privacy note: number used only for flood alerts, not shared with third parties

### API
- `/api/sms-subscribe` (POST) → Twilio SMS integration

---

## 17. Education Hub

**Route:** `/education`  
**File:** `app/education/page.tsx`

### Features
- **Knowledge Base** for flood education
- Article grid (3 columns) with categories:
  - ANALISIS (Analysis articles)
  - Educational content about flood preparedness
  - Understanding hydrology data
- Article cards with category badges, image placeholders
- Links to individual article pages (e.g., `/education/kenapa-jakarta-banjir`)

---

## 18. Settings

**Route:** `/settings`  
**File:** `app/settings/page.tsx`

### Features
- Theme toggle (Sun/Moon/Monitor)
- Location preferences
- Notification settings (bell, volume)
- Map preferences
- Accessibility options (font size, contrast)
- Data management (database, cleanup)
- Language selection (globe)

---

## 19. Supporting Pages

### Contact (`/contact`)
- Contact form with fields: Name, Email, Organization, Region, Message
- Submission simulation (2s delay)
- Success confirmation state
- Sidebar hidden on this page

### Privacy Policy (`/privacy`)
- Static content: data collection, sensor data usage, contact info
- Prose-styled page

### Data Source (`/data-source`)
- Transparency page explaining data origins
- 2-column grid: IoT Sensors vs BMKG & Satellite
- Update frequency info

### About (`/about.html`)
- Static HTML page about the project
- Accessed via sidebar link with `?mode=read`

---

## 20. API Routes (Backend)

The app has **30 API route directories** under `app/api/`:

| Category | Route | Purpose |
|---|---|---|
| **AI / ML** | `/api/predict` | LSTM flood prediction |
| | `/api/chatbot` | Gemini AI chatbot |
| | `/api/ai-alerts` | AI-generated alert analysis |
| | `/api/flood-analysis` | Flood data analysis |
| | `/api/analysis` | General data analysis |
| | `/api/news-summary` | Gemini news summarization |
| | `/api/smart-alert` | Smart alert generation |
| | `/api/cctv-scan` | CCTV image scanning (YOLO) |
| | `/api/verify-visual` | Visual flood verification (YOLO) |
| | `/api/ml-health` | ML model health check |
| | `/api/scenarios` | Prediction scenarios |
| **Weather** | `/api/weather` | Weather data proxy (OpenWeatherMap) |
| | `/api/weather-history` | Historical weather data |
| | `/api/air-quality` | Air quality index |
| | `/api/rainfall-dual` | Dual rainfall data (Bogor + Jakarta) |
| **Data** | `/api/dashboard` | Dashboard data aggregation |
| | `/api/alerts` | Alert data |
| | `/api/flood-reports` | Flood report CRUD |
| | `/api/water-level` | Water level data |
| | `/api/sensor-simulator` | Sensor data simulation |
| | `/api/statistics` | Statistics data |
| | `/api/regions` | Region list data |
| | `/api/evacuation` | Evacuation locations |
| | `/api/disaster-reports` | Disaster reports |
| | `/api/disaster-proxy` | Disaster data proxy |
| **SMS** | `/api/sms-subscribe` | SMS subscription (Twilio) |
| | `/api/sms-alert` | SMS alert sending |
| **System** | `/api/health` | System health check |
| | `/api/preferences` | User preference storage |
| | `/api/test` | Test endpoint |

---

## 21. Education Sub-Pages

**Route:** `/education/[slug]`

Four article sub-routes under the Education Hub:

| Slug | Topic |
|---|---|
| `banjir-jakarta-realtime` | Real-time Jakarta flooding information |
| `kenapa-jakarta-banjir` | Why Jakarta floods — causes and context |
| `panduan-siaga-banjir` | Flood preparedness guide |
| `teknologi-monitoring-banjir` | Flood monitoring technology explained |

---

## 22. Bundled ML Service (`ml-service/`)

A **self-contained Python ML microservice** bundled inside the project with its own Dockerfile.

### Source Code (`ml-service/src/`)

| File | Purpose |
|---|---|
| `main.py` | FastAPI entrypoint — serves `/predict`, `/detect`, `/health`, `/metrics` |
| `lstm_model.py` | LSTM flood forecasting model (water level prediction) |
| `yolo_model.py` | YOLOv8 flood detection from images |
| `preprocessing.py` | Data preprocessing pipeline |
| `scenarios.py` | Pre-defined prediction scenarios |
| `metrics.py` | Model performance metrics |

### Pre-trained Models (`ml-service/models/`)

| File | Purpose |
|---|---|
| `lstm_flood_forecaster.h5` | Primary LSTM model for flood prediction |
| `lstm_model.h5` | Secondary/legacy LSTM model |
| `lstm_scaler_features.pkl` | Feature scaler for LSTM input |
| `lstm_scaler_X.pkl` | X-axis scaler |
| `lstm_scaler_y.pkl` | Y-axis scaler |
| `scaler.pkl` | General scaler |
| `yolo_model.pt` | Fine-tuned YOLOv8 for flood detection |
| `yolov8n.pt` | Base YOLOv8 nano model |
| `preprocessed_data.csv` | Pre-processed training data cache |
| `training_results.json` | Training metrics and history |
| `training_accuracy_plot.png` | Training accuracy visualization |

### Training Data (`ml-service/data/`)

| File | Purpose |
|---|---|
| `DATASET_FINAL_TRAINING.csv` | Final combined training dataset |
| `floodgauges_dummy.json` | Simulated flood gauge readings |
| `hujan_bogor2022.csv` | Bogor rainfall data (2022) |
| `rainfall_dummy.json` | Simulated rainfall data |
| `tma_2020.xlsx.csv` | Water level data (2020) |

### Deployment
- Has its own `Dockerfile` and `requirements.txt`
- Orchestrated via project-root `docker-compose.yml`
- Next.js API routes proxy to this service (e.g., `/api/predict` → `ml-service:8000/predict`)

---

## 23. Database Schema (Supabase)

### Migrations

5 migration files in `supabase/migrations/`:

#### `001_initial_schema.sql`
| Table | Purpose | Key Columns |
|---|---|---|
| `evacuation_locations` | Evacuation shelter registry | name, address, lat/lon, capacity_current/total, facilities (array), contact_person/phone |
| `laporan_banjir` | Community flood reports | location, lat/lon, water_level, description, photo_url, reporter_name/contact, status |

- Seeds 30 evacuation locations across Indonesia (Jakarta, Surabaya, Bandung, Medan, Makassar, Semarang, Palembang, etc.)

#### `20250309000000_create_predictions_detections.sql`
| Table | Purpose | Key Columns |
|---|---|---|
| `predictions` | LSTM prediction results | region_id, prediction_cm, risk_level (AMAN/WASPADA/BAHAYA/CRITICAL), rainfall_bogor/jakarta, water_level_cm, source (manual/auto/scenario) |
| `detections` | YOLO detection results | source_name, is_flooded, flood_probability, objects_detected (JSONB), snapshot_url, location_lat/lon |

#### `20250309100000_create_sms_subscribers.sql`
| Table | Purpose | Key Columns |
|---|---|---|
| `sms_subscribers` | SMS alert registrations | phone_number, name, region_id, language (id/en), is_active. Unique on (phone_number, region_id) |
| `sms_logs` | SMS sending audit trail | subscriber_id (FK), phone_number, message, alert_level, region_id, status (queued/sent/failed), twilio_sid |

#### `20250818100000_create_historical_incidents_table.sql`
| Table | Purpose | Key Columns |
|---|---|---|
| `historical_incidents` | Past flood incident records | type, location, date, severity (1-10), impact_areas, duration_hours, reported_losses, casualties, evacuees, damage_level, response_time_minutes, status (resolved/ongoing/monitoring) |

#### `20250818110000_create_alerts_table.sql`
| Table | Purpose | Key Columns |
|---|---|---|
| `alerts` | Real-time disaster alerts | level (Rendah/Sedang/Tinggi), location, reason, details, affected_areas, estimated_population, severity (1-10). RLS enabled with public read access |

### Seed Data
- `supabase/seed.sql` — Additional seed data for development

### Total Tables: 7
`evacuation_locations`, `laporan_banjir`, `predictions`, `detections`, `sms_subscribers`, `sms_logs`, `historical_incidents`, `alerts`

> **Correction: 8 tables total**

---

## 24. Custom Hooks (Data Layer)

13 custom React hooks that form the data-fetching and state layer:

| Hook | File | Purpose |
|---|---|---|
| `useTheme` | `hooks/useTheme.tsx` | Theme provider with dark/light/system/high-contrast support |
| `useMediaQuery` | `hooks/useMediaQuery.ts` | Responsive breakpoint detection |
| `useDebounce` | `hooks/useDebounce.ts` | Debounced value for search inputs |
| `useDeviceCapabilities` | `hooks/useDeviceCapabilities.ts` | Device feature detection (touch, GPU, etc.) |
| `useUIStore` | `hooks/useUIStore.ts` | Zustand-based UI state (sidebar open, modals, etc.) |
| `useWeatherData` | `hooks/useWeatherData.ts` | Fetches weather from `/api/weather` |
| `useAirPollutionData` | `hooks/useAirPollutionData.ts` | Fetches air quality index data |
| `useBmkgQuakeData` | `hooks/useBmkgQuakeData.ts` | Fetches BMKG earthquake data |
| `useDisasterData` | `hooks/useDisasterData.ts` | Fetches disaster reports/alerts |
| `usePredictionData` | `hooks/usePredictionData.ts` | Fetches LSTM prediction results |
| `usePumpStatusData` | `hooks/usePumpStatusData.ts` | Fetches infrastructure pump status |
| `useRegionData` | `hooks/useRegionData.ts` | Fetches Indonesian administrative regions (cascading) |
| `useWaterLevelData` | `hooks/useWaterLevelData.ts` | Fetches water level monitoring data |

---

## 25. Infrastructure Utilities

### Backend Utilities (`src/lib/`)

| File | Purpose |
|---|---|
| `rateLimiter.ts` | API rate limiting (token bucket or sliding window) |
| `redis.ts` | Upstash Redis client configuration |
| `cache.ts` | Caching layer built on Redis |
| `logger.ts` | Structured logging utility |
| `requestId.ts` | Request tracing / correlation ID generation |
| `getIp.ts` | Client IP extraction from headers |

### Frontend Utilities (`lib/`)

| File | Purpose |
|---|---|
| `utils.ts` | General utilities including `cn()` (clsx + twMerge), formatters, device detection |
| `utils.test.ts` | Unit tests for utilities |
| `store.ts` | Zustand store for selected location + map bounds |
| `constants.ts` | App-wide constants and mock data definitions |
| `mock-data.ts` | Mock data generators for development |
| `schemas.ts` | Zod validation schemas for forms and API payloads |
| `error-utils.ts` | Error handling and formatting utilities |
| `geocodingService.ts` | Address ↔ coordinate resolution (Nominatim) |
| `indexeddb.ts` | Client-side IndexedDB for offline data persistence |
| `leaflet-fix.ts` | Leaflet SSR compatibility patch for Next.js |
| `mapUtils.ts` | Map helper functions (distance calc, bounds, etc.) |
| `api.ts` | Shared API client utilities |
| `api.client.ts` | Client-side API helpers |
| `api.server.ts` | Server-side API helpers |

### Supabase Clients (`lib/supabase/`)

| File | Purpose |
|---|---|
| `client.ts` | Browser-side Supabase client |
| `server.ts` | Server Component Supabase client |
| `admin.ts` | Service-role Supabase client (elevated permissions) |

Also: `supabaseAdmin.ts` in `lib/` root — legacy admin client (may be duplicate of `lib/supabase/admin.ts`)

---

## 26. Type Definitions (`types/`)

| File | Purpose |
|---|---|
| `index.ts` | Main type exports — shared interfaces and types |
| `index.d.ts` | Ambient type declarations |
| `airPollution.ts` | Air pollution/quality data types |
| `geocoding.ts` | Geocoding response types |
| `location.ts` | Location and coordinate types |
| `leaflet-routing-machine.d.ts` | Type declarations for leaflet-routing-machine plugin |

---

## 27. Undocumented Components

Components not captured in the main component tree:

| File | Purpose |
|---|---|
| `components/background/Lightning.tsx` | Animated lightning background effect (with `Lightning.css`) |
| `components/region-selector/RegionDropdown.tsx` | Cascading region selector (Province → Regency → District → Village) |
| `components/styles/landing.css` | Landing page-specific styles |
| `components/LanguageSwitcher.tsx` | Standalone language toggle component (ID/EN) |
| `components/MapDisplay.tsx` | Standalone map display component |
| `components/weather-shortcut.tsx` | Quick-access weather shortcut component |

---

## 28. Static HTML Pages (`public/`)

The app maintains static HTML counterparts alongside React pages:

| File | React Equivalent | Purpose |
|---|---|---|
| `landing.html` | `/` (rewrites to this) | Landing page (primary entry point) |
| `about.html` | `/about.html?mode=read` | About page |
| `contact.html` | `/contact` | Contact form |
| `privacy.html` | `/privacy` | Privacy policy |
| `data-source.html` | `/data-source` | Data source transparency |
| `404.html` | Next.js 404 | Custom 404 error page |

### Other Public Assets

| File/Dir | Purpose |
|---|---|
| `assets/`, `css/`, `js/` | Static asset directories for HTML pages |
| `leaflet/` | Leaflet map assets (markers, icons) |
| `RobotExpressive.glb` | 3D robot model (Three.js/WebGL asset for landing) |
| `robonoah.ai.png` | Noah.ai robot mascot image |
| `sw.js` + `workbox-*.js` | Service worker for PWA offline support |
| `web-app-manifest-192x192.png` | PWA icon (192px) |
| `web-app-manifest-512x512.png` | PWA icon (512px) |
| `apple-icon.png` | Apple touch icon |
| `icon1.png` | Favicon |
| `google39dcc95b5ae64a3b.html` | Google Search Console verification |

---

## 29. Instrumentation & Monitoring

| File | Purpose |
|---|---|
| `instrumentation.ts` | Server-side instrumentation (Sentry error tracking setup) |
| `instrumentation-client.ts` | Client-side instrumentation (Sentry browser SDK) |

---

## 30. Jakarta-Floodnet Features (To Integrate)

Jakarta-Floodnet is a **Python/FastAPI backend** with its own Streamlit dashboard. Key features to integrate into the refactored Noah.ai:

| Feature | Current State in Noah.ai | Integration Needed |
|---|---|---|
| **LSTM Prediction Model** | ✅ Already proxied via `/api/predict` | Direct integration, improve UI |
| **YOLOv8 Flood Detection** | ✅ Already proxied via `/api/verify-visual` and `/api/cctv-scan` | Enhance with live CCTV feeds |
| **Sensor Simulator** | ✅ `/api/sensor-simulator` exists | Surface better in Command Center |
| **Real-time Monitoring** | ⚠️ Mock data in Noah.ai | Replace mocks with live sensor feeds |
| **Streamlit Dashboard** | ❌ Not integrated (separate app) | Merge visualizations into React |
| **Health/Metrics Endpoints** | ✅ `/api/ml-health` proxied | Show in system status bar |

### Jakarta-Floodnet API Endpoints
- `POST /predict` — Flood probability prediction
- `POST /detect` — Flood area detection from images
- `GET /health` — System health
- `GET /metrics` — Model performance metrics

---

## 31. User Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        LANDING PAGE                          │
│                 (first visit shows intro)                     │
│              ┌──────────────────────────┐                     │
│              │    "Enter Dashboard" →   │                     │
│              └───────────┬──────────────┘                     │
└──────────────────────────┼───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        DASHBOARD                             │
│  Stats | Water Levels | Pumps | Alerts | Earthquake | Chat   │
│                                                              │
│  Sidebar Navigation ──────────────────────────────────────┐  │
│                                                           │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │ Flood Map   │  │ Weather      │  │ Alerts          │  │  │
│  │ • Map view  │  │ • Current    │  │ • Real-time     │  │  │
│  │ • Reports   │  │ • Forecast   │  │ • News feed     │  │  │
│  │ • Filters   │  │ • Map layers │  │ • AI analysis   │  │  │
│  │ • Routing   │  │ • Search     │  │ • Severity      │  │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│                                                           │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │ Report      │  │ LSTM Predict │  │ Visual Verify   │  │  │
│  │ • Form      │  │ • Auto/Man.  │  │ • Upload image  │  │  │
│  │ • Map pick  │  │ • Scenarios  │  │ • YOLO detect   │  │  │
│  │ • Photo     │  │ • Risk level │  │ • Probability   │  │  │
│  │ • ML score  │  │ • ML health  │  │ • Objects       │  │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│                                                           │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │ CCTV Sim    │  │ Evacuation   │  │ Sensor Data     │  │  │
│  │ • 4-channel │  │ • Map + list │  │ • Supabase      │  │  │
│  │ • Controls  │  │ • Services   │  │ • Statistics    │  │  │
│  │ • YOLO      │  │ • Navigate   │  │ • Real-time     │  │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│                                                           │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │ Statistics  │  │ SMS Alert    │  │ Education       │  │  │
│  │ • Charts    │  │ • Subscribe  │  │ • Articles      │  │  │
│  │ • History   │  │ • Region sel │  │ • Knowledge     │  │  │
│  │ • AI chat   │  │ • SMS sample │  │ • Best practice │  │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│                                                           │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │ Settings    │  │ Contact      │  │ Privacy/About   │  │  │
│  │ • Theme     │  │ • Form       │  │ • Static pages  │  │  │
│  │ • Language  │  │ • Feedback   │  │ • Data sources  │  │  │
│  │ • Access.   │  │              │  │                 │  │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
└──────────────────────────────────────────────────────────────┘
```

---

## Summary: Feature Count

| Category | Count |
|---|---|
| Frontend Pages | 18 + 4 education sub-pages |
| API Routes | 30 |
| Navigation Items | 12 + 3 bottom bar |
| AI/ML Integrations | 3 (Gemini, LSTM, YOLO) |
| External APIs | 3 (OpenWeatherMap, BMKG, Nominatim) |
| Database Tables | 8 (evacuation_locations, laporan_banjir, predictions, detections, sms_subscribers, sms_logs, historical_incidents, alerts) |
| Custom Hooks | 13 |
| Backend Utilities | 6 (rate limiter, Redis, cache, logger, request ID, IP detection) |
| Frontend Utilities | 13 |
| Supabase Clients | 3 (browser, server, admin) |
| Type Definition Files | 6 |
| Static HTML Pages | 6 |
| Pre-trained ML Models | 8 (2 LSTM, 2 YOLO, 4 scalers) |
| Training Datasets | 5 |
| Languages | 2 (ID, EN) |
| Supabase Migrations | 5 |

> **Total estimated lines of page code:** ~5,000+ lines across 22 page components
