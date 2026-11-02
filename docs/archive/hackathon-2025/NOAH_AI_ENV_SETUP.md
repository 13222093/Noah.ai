# 🔐 noah.ai — Environment Setup Guide

> Since noah.ai is built on top of noah.ai (another person's project), you need to set up all API keys and services yourself. This guide covers **everything** you need.

---

## Quick Overview

| Service | What It's For | Cost | Required? |
|---------|--------------|------|-----------|
| Supabase | Database, auth, storage | Free tier | ✅ Yes |
| OpenWeatherMap | Weather data, rainfall, forecasts | Free tier (1K calls/day) | ✅ Yes |
| Google Gemini | AI analysis, chatbot, alerts | Free tier (60 req/min) | ✅ Yes |
| Roboflow | YOLO flood detection model hosting | Free tier | ✅ For Visual Verify |
| Upstash Redis | API rate limiting & caching | Free tier (10K cmds/day) | ⚠️ Recommended |
| Sentry | Error monitoring & performance | Free tier | ❌ Optional |
| WAQI | Air quality data | Free tier | ❌ Optional |
| Vercel | Deployment | Free tier | ❌ Optional (for deploy) |

---

## Step-by-Step Setup

### 1. 🗄️ Supabase (Database)

**Sign up:** https://supabase.com → Create new project

**Get these values:**
| Variable | Where to Find |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (⚠️ keep secret!) |

**Database setup:**
```bash
# Option A: Use Supabase CLI (recommended)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db reset    # Applies migrations from supabase/migrations/

# Option B: Use Docker local DB
# Set USE_DOCKER_DB=true in .env.local
# DATABASE_URL=postgresql://noah.ai:noah.ai@db:5432/noah.ai_dev
```

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY`** has full database access — never expose it client-side or commit it to git.

---

### 2. 🌦️ OpenWeatherMap (Weather Data)

**Sign up:** https://openweathermap.org/api → Create account → Get API key

**Get these values:**
| Variable | Details |
|----------|---------|
| `OPENWEATHER_API_KEY` | Your API key (used server-side for `/api/weather`, `/api/dashboard`) |
| `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` | Same key (used client-side for map weather tiles) |

> Note: The codebase also references `OPEN_WEATHER_API_KEY` (with underscore) in some routes like `/api/weather-history` and `/api/chatbot`. Use the **same key** for all OpenWeather variables.

**Free tier:** 1,000 API calls/day, current weather + 5-day forecast.

---

### 3. 🤖 Google Gemini API (AI Analysis & Chatbot)

**Sign up:** https://aistudio.google.com/apikey → Create API key

**Get these values:**
| Variable | Used By |
|----------|---------|
| `GEMINI_API_KEY` | `/api/analysis`, `/api/chatbot`, `/api/ai-alerts` |
| `GOOGLE_API_KEY` | `/api/flood-analysis` (same key works) |

> You can use the **same key** for both variables. Gemini 1.5 Flash is free at 60 requests/minute.

---

### 4. 📸 Roboflow (YOLO Flood Detection)

**Sign up:** https://roboflow.com → Create account

**Get this value:**
| Variable | Where to Find |
|----------|--------------|
| `ROBOFLOW_API_KEY` | Roboflow Dashboard → Settings → API Key |

**What it does:** The ML service uses Roboflow's hosted YOLOv8 model for flood object detection in the Visual Verify feature. If you have your own YOLO model weights (the repo includes `yolov8n.pt`), the system can fall back to local inference.

---

### 5. ⚡ Upstash Redis (Rate Limiting & Caching)

**Sign up:** https://upstash.com → Create Redis database

**Get these values:**
| Variable | Where to Find |
|----------|--------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Console → Your Database → REST API → Endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → Your Database → REST API → Token |

**What it does:**
- Rate limits API routes to 60 requests/min per IP
- Caches API responses (default 60s TTL)
- Without it, the app still works but without rate limiting/caching

---

### 6. 🛡️ Sentry (Error Monitoring) — Optional

**Sign up:** https://sentry.io → Create project (Next.js)

**Get these values:**
| Variable | Default | Details |
|----------|---------|---------|
| `SENTRY_DSN` | — | Your project DSN |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | 10% of transactions sampled |
| `SENTRY_PROFILES_SAMPLE_RATE` | `0.0` | Profiling disabled by default |
| `SENTRY_ENVIRONMENT` | `development` | Set to `production` for deploy |

---

### 7. 🌬️ WAQI (Air Quality) — Optional

**Sign up:** https://aqicn.org/data-platform/token/ → Request token

**Get this value:**
| Variable | Used By |
|----------|---------|
| `WAQI_API_TOKEN` | `/api/air-quality` route |

> Not in `.env.example` but referenced in the code. Without it, the air quality feature won't work.

---

## Complete `.env.local` Template

Copy this into `flood/.env.local` and fill in your values:

```env
# ===== Runtime Mode =====
USE_DOCKER_DB=false
USE_PUBLIC_DEV_DB=true
USE_MOCK_EXTERNAL_API=false

# ===== Supabase =====
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# ===== Weather =====
OPENWEATHER_API_KEY=your-openweather-key
NEXT_PUBLIC_OPENWEATHERMAP_API_KEY=your-openweather-key
OPEN_WEATHER_API_KEY=your-openweather-key

# ===== AI / ML =====
GEMINI_API_KEY=your-gemini-key
GOOGLE_API_KEY=your-gemini-key
ML_API_URL=http://localhost:8000
ROBOFLOW_API_KEY=your-roboflow-key

# ===== Cache / Rate Limit =====
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# ===== Air Quality (Optional) =====
WAQI_API_TOKEN=your-waqi-token

# ===== Observability (Optional) =====
SENTRY_DSN=https://your-dsn.ingest.sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.0
SENTRY_ENVIRONMENT=development

# ===== App =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## ML Service Environment

The Python ML service (`ml-service/`) has its own env vars, set in `docker-compose.yml` or your shell:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MODEL_PATH` | `./models` | Directory containing LSTM model files |
| `YOLO_PATH` | `./models/yolov8n.pt` | Path to YOLO weights |
| `ROBOFLOW_API_KEY` | — | Same key as above, for Roboflow-hosted YOLO |

---

## Minimum Viable Setup

If you want to get running ASAP with the least work, here's what's **strictly required**:

```env
# Bare minimum to run the app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENWEATHER_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_API_KEY=...
ML_API_URL=http://localhost:8000
```

This gets you: weather, maps, alerts, dashboard, chatbot, flood prediction, and visual verify (with local YOLO model).

**Add later if needed:** Roboflow, Upstash Redis, Sentry, WAQI.

---

## Accounts Checklist

- [ ] Supabase account created + project set up
- [ ] OpenWeatherMap account + API key
- [ ] Google AI Studio + Gemini API key
- [ ] Roboflow account + API key
- [ ] Upstash account + Redis database
- [ ] Sentry account + project (optional)
- [ ] WAQI token (optional)
- [ ] `.env.local` created with all values filled
- [ ] Supabase migrations applied (`npx supabase db reset`)
- [ ] ML service running (`uvicorn src.main:app --port 8000`)
- [ ] Next.js running (`npm run dev`)
