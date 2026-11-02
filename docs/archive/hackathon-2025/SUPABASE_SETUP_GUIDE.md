# Supabase Setup Guide for noah.ai Deployment

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → Sign up / Sign in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `noah-ai` (or anything)
   - **Database Password:** pick a strong one (save it!)
   - **Region:** Southeast Asia (Singapore) — closest to Indonesia
4. Click **"Create Project"** → wait ~2 minutes

## Step 2: Get Your API Keys

1. In your Supabase project → **Settings** → **API**
2. Copy these 3 values:

| What | Where in Supabase |
|------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** — `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Project API keys** → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project API keys** → `service_role` `secret` (click "Reveal") |

## Step 3: Create Tables & Seed Data

Go to **SQL Editor** (left sidebar) → Click **"New Query"** → paste and run each block below **one at a time**:

### 3a. Enable UUID extension
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3b. Create Evacuation + Flood Reports tables (with 37 evacuation locations)
Copy the entire content from:
```
Floodzy/supabase/migrations/001_initial_schema.sql
```
This creates `evacuation_locations` and `laporan_banjir` tables, and inserts 37 evacuation locations across Indonesia.

### 3c. Create Historical Incidents table
Copy the entire content from:
```
Floodzy/supabase/migrations/20250818100000_create_historical_incidents_table.sql
```

### 3d. Create Alerts table
Copy the entire content from:
```
Floodzy/supabase/migrations/20250818110000_create_alerts_table.sql
```

### 3e. Seed Historical Incidents + Alerts data
Copy the entire content from:
```
Floodzy/supabase/seed.sql
```

### 3f. Create SMS Subscribers table
```sql
CREATE TABLE IF NOT EXISTS public.sms_subscribers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number TEXT NOT NULL UNIQUE,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sms_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for sms_subscribers"
    ON public.sms_subscribers
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### 3g. Create Region Tables (provinces, regencies, districts, villages)

> **⚠️ IMPORTANT:** These are large tables with Indonesian administrative data (34 provinces, 514 regencies, 7,000+ districts). You need to import this data.

```sql
-- Provinces
CREATE TABLE IF NOT EXISTS public.provinces (
    province_code VARCHAR(10) PRIMARY KEY,
    province_name TEXT NOT NULL,
    province_latitude NUMERIC,
    province_longitude NUMERIC
);

-- Regencies / Cities
CREATE TABLE IF NOT EXISTS public.regencies (
    city_code VARCHAR(10) PRIMARY KEY,
    city_name TEXT NOT NULL,
    city_province_code VARCHAR(10) REFERENCES public.provinces(province_code),
    city_latitude NUMERIC,
    city_longitude NUMERIC
);

-- Districts / Kecamatan
CREATE TABLE IF NOT EXISTS public.districts (
    sub_district_code VARCHAR(10) PRIMARY KEY,
    sub_district_name TEXT NOT NULL,
    sub_district_city_code VARCHAR(10) REFERENCES public.regencies(city_code),
    sub_district_latitude NUMERIC,
    sub_district_longitude NUMERIC,
    sub_district_geometry JSONB
);

-- Villages (optional)
CREATE TABLE IF NOT EXISTS public.villages (
    village_code VARCHAR(20) PRIMARY KEY,
    village_name TEXT NOT NULL,
    village_sub_district_code VARCHAR(10) REFERENCES public.districts(sub_district_code),
    village_postal_codes TEXT,
    village_latitude NUMERIC,
    village_longitude NUMERIC,
    village_geometry JSONB
);

-- Enable RLS with public read
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read provinces" ON public.provinces FOR SELECT USING (true);
CREATE POLICY "Public read regencies" ON public.regencies FOR SELECT USING (true);
CREATE POLICY "Public read districts" ON public.districts FOR SELECT USING (true);
CREATE POLICY "Public read villages" ON public.villages FOR SELECT USING (true);
```

**To populate the region data**, use the API from [github.com/cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) or import CSV from [Regions of Indonesia dataset](https://github.com/edwardsamuel/Wilayah-Administratif-Indonesia). Ask Jason if the original Supabase already has this data — they can export the CSV from the existing project.

## Step 4: Add Environment Variables to Vercel

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add each one:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | (from Step 2) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Step 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Step 2) |
| `OPENWEATHER_API_KEY` | Get from [openweathermap.org/api](https://openweathermap.org/api) |
| `GEMINI_API_KEY` | Get from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GOOGLE_API_KEY` | Same as Gemini key |

3. Click **Save** → Go to **Deployments** → click ⋯ → **Redeploy**

## Step 5: Verify

After redeployment, check:
- ✅ Evacuation tab shows 37 locations
- ✅ Region selector dropdown loads provinces
- ✅ Weather data loads (OpenWeather)
- ✅ AI chatbot responds (Gemini)
