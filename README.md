# noah.ai — Flood Monitoring Platform

Unified flood monitoring platform combining **noah.ai** (Next.js, Supabase, Gemini AI) and **Jakarta-Floodnet** (LSTM prediction, YOLO visual verification). Built with Next.js 16, shadcn/ui, Tailwind CSS, and a Python FastAPI ML microservice.

## Repository Structure

| Directory | Description |
|-----------|-------------|
| **ProjectX** | Main unified app — Next.js frontend + Python ML service |
| **noah.ai** | Original noah.ai source (reference) |
| **Jakarta-Floodnet** | Original Floodnet source (reference) |

**Use ProjectX** for development and deployment.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10–3.12 (for ML service; 3.13 has TensorFlow path issues on Windows)
- **Docker** & Docker Compose (optional, for containerized runs)

---

## Quick Start (Docker)

```bash
cd ProjectX
docker-compose up --build
```

- **Next.js:** http://localhost:3000  
- **ML API:** http://localhost:8000  

---

## Manual Setup

### 1. Next.js Frontend

```bash
cd ProjectX
npm install
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

Open http://localhost:3000

### 2. ML Service (Python)

```bash
cd ProjectX/ml-service
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Set `ML_API_URL=http://localhost:8000` in `.env.local` so the frontend talks to the ML service.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap API key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `ML_API_URL` | Yes | ML service URL (e.g. `http://localhost:8000`) |
| `ROBOFLOW_API_KEY` | For Visual Verify | Roboflow API key for YOLO detection |
| `UPSTASH_REDIS_REST_URL` | Optional | Redis for rate limiting/caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Redis token |

---

## Windows Notes

### Long Paths (TensorFlow)

If `pip install` fails with path length errors when installing TensorFlow:

1. **Enable long paths** (run PowerShell as Administrator):
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```
   Then restart your computer.

2. **Or use a shorter venv path:**
   ```powershell
   python -m venv C:\ml-venv
   C:\ml-venv\Scripts\activate
   cd ProjectX\ml-service
   pip install -r requirements.txt
   ```

### Standalone Build

For Docker builds, standalone output is enabled via `NEXT_STANDALONE=1`. For local builds on Windows, it is disabled to avoid copyfile errors.

---

## Key Features

- **Flood Map** (`/flood-map`) — Interactive map with flood reports and evacuation points  
- **Flood Predict** (`/flood-predict`) — LSTM-based water level prediction  
- **Visual Verify** (`/visual-verify`) — YOLO image analysis for flood detection  
- **Sensor Data** (`/sensor-data`) — Real-time sensor simulator  
- **Dashboard** (`/dashboard`) — Overview with ML status  
- **Alerts** (`/alerts`) — Disaster alerts  
- **Weather** — Current and forecast weather  

---

## Scripts

### Next.js (ProjectX)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

### ML Service

```bash
cd ProjectX/ml-service
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

---

## License

MIT
