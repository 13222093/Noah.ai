# CCTV Flood Detection Tab — Bottom Tile Plan

## Goal

Add a **"CCTV AI"** tab to the bottom tile showing CCTV camera feeds sorted by detection status — cameras that **confirmed flood** appear first. Clicking "See Full" redirects to `/cctv-simulation` (the full CCTV monitoring page).

---

## Existing Infrastructure (What We Already Have)

### noah.ai (Next.js Frontend)
| Asset | Path | Status |
|-------|------|--------|
| CCTV Scan API | `/api/cctv-scan/route.ts` | ✅ Working — fetches frame from URL → sends to ML `/verify-visual` |
| CCTV Simulation Page | `/cctv-simulation/page.tsx` | ⚠️ Placeholder only — 4 generic offline channels, no real data |
| Visual Verify Page | `/visual-verify/page.tsx` | ✅ Working — manual image upload → YOLO analysis |
| YOLO button in Left Tile | `LeftTile.tsx` (AI Tools tab) | ✅ "YOLO Verify" button exists |

### Jakarta-Floodnet (Python Backend)
| Asset | Path | Status |
|-------|------|--------|
| YOLO Visual Verify | `POST /verify-visual` | ✅ Accepts image file → returns `{is_flooded, flood_probability, objects_detected}` |
| CCTV Locations Data | `04_Simulasi_CCTV.py` | ✅ 4 locations: Manggarai, Katulampa, Karet, Sunter |
| YOLO Model | `yolov8n.pt` + `FloodVisualVerifier` | ✅ Loaded at startup |

---

## Proposed Design: "CCTV AI" Tab

### Layout (Bottom Tile - Horizontal Grid)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📹 CCTV Flood Detection          🟢 2/4 Online    [See Full →]        │
├─────────┬─────────┬─────────┬─────────┬────────────────────────────────┤
│ 🔴 BANJIR│ 🔴 BANJIR│ 🟢 NORMAL│ ⚪ OFFLINE│                              │
│ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │  Summary:                     │
│ │ 📹  │ │ │ 📹  │ │ │ 📹  │ │ │     │ │  • 2 BANJIR TERDETEKSI        │
│ │frame│ │ │frame│ │ │frame│ │ │ off │ │  • 1 NORMAL                   │
│ └─────┘ │ └─────┘ │ └─────┘ │ └─────┘ │  • 1 OFFLINE                  │
│ Manggarai│ Katulmp │ Karet  │ Sunter  │  Last scan: 2 mnt lalu        │
│ 95% conf│ 82% conf│ 12%    │ --      │                                │
│ 1m lalu │ 3m lalu │ 5m lalu│         │                                │
└─────────┴─────────┴─────────┴─────────┴────────────────────────────────┘
```

### Key Design Decisions

1. **Mock Data for Hackathon** — Since CCTV URLs aren't live, use **mock detection results** (like the existing `FLOOD_MOCK_ALERTS` pattern). Each camera has a pre-defined `is_flooded`, `flood_probability`, and `last_scan` timestamp.

2. **Sorted by Detection** — Cameras with `is_flooded: true` always appear first (red border), then normal (green), then offline (gray).

3. **Compact Card Design** — Each CCTV card shows:
   - Status badge: `🔴 BANJIR` / `🟢 NORMAL` / `⚪ OFFLINE`
   - Camera placeholder thumbnail (dark box with 📹 icon + overlay)
   - Location name (e.g., "PA Manggarai")
   - Confidence % (flood probability)
   - Relative time since last scan

4. **Summary Panel** (right side) — Quick counts: X banjir terdeteksi, Y normal, Z offline, last scan time.

5. **"See Full" → `/cctv-simulation`** — Links to the full page. We should also update that page to use the same mock data for consistency.

---

## Data Structure

### Mock CCTV Data (in `BottomTile.tsx` or `lib/constants.ts`)

```typescript
const CCTV_CHANNELS = [
  {
    id: 'manggarai',
    name: 'PA Manggarai',
    location: 'Manggarai, Jakarta Selatan',
    coordinates: [-6.2297, 106.8507],
    status: 'online' as const,
    is_flooded: true,
    flood_probability: 0.95,
    objects_detected: ['flood', 'water', 'debris'],
    last_scan: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    thumbnail: null, // placeholder
  },
  {
    id: 'katulampa',
    name: 'Bendung Katulampa',
    location: 'Bogor, Jawa Barat',
    coordinates: [-6.6312, 106.8501],
    status: 'online' as const,
    is_flooded: true,
    flood_probability: 0.82,
    objects_detected: ['flood', 'water'],
    last_scan: new Date(Date.now() - 180000).toISOString(), // 3 min ago
    thumbnail: null,
  },
  {
    id: 'karet',
    name: 'PA Karet',
    location: 'Tanah Abang, Jakarta Pusat',
    coordinates: [-6.1975, 106.8157],
    status: 'online' as const,
    is_flooded: false,
    flood_probability: 0.12,
    objects_detected: [],
    last_scan: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    thumbnail: null,
  },
  {
    id: 'sunter',
    name: 'Pos Pantau Sunter',
    location: 'Sunter, Jakarta Utara',
    coordinates: [-6.1469, 106.8726],
    status: 'offline' as const,
    is_flooded: false,
    flood_probability: 0,
    objects_detected: [],
    last_scan: null,
    thumbnail: null,
  },
];
```

---

## Implementation Steps

### Step 1: Add "CCTV AI" tab to `BottomTile.tsx`
- Add `{ id: 'cctv', label: 'CCTV AI', icon: Video }` to `BOTTOM_TABS`
- Import `Video` icon from `lucide-react`

### Step 2: Add mock CCTV data
- Define `CCTV_CHANNELS` array inside `BottomTile.tsx` (or import from constants)
- Sort: flooded first → online → offline

### Step 3: Render the CCTV card grid
- Left ~70%: Horizontal grid of 4 camera cards
  - Each card: dark bg, status badge at top, camera icon placeholder, name, confidence bar, relative time
  - Flooded cameras: red border/glow pulsing effect
  - Normal cameras: green subtle border
  - Offline: gray, dimmed
- Right ~30%: Summary panel with detection counts and last scan time

### Step 4: Add See Full route
- When `activeTab === 'cctv'` → `seeFullRoute = '/cctv-simulation'`

### Step 5: (Optional) Update `/cctv-simulation/page.tsx`
- Replace the 4 generic channels with the same `CCTV_CHANNELS` data
- Add the detection status badges matching the bottom tile cards
- This is optional and can be done later

---

## Feasibility Notes

> [!IMPORTANT]
> This uses **mock data only** for the hackathon demo. The real CCTV pipeline (`/api/cctv-scan` → ML `/verify-visual`) already works but requires:
> 1. Live CCTV stream URLs (not available for demo)
> 2. ML service running (`uvicorn services.api_gateway.src.main:app`)

> [!TIP]
> For the pitch demo, the mock data tells a compelling story:
> - 2 cameras detect flooding (Manggarai + Katulampa = upstream to downstream)
> - 1 camera normal (Karet = not yet affected)
> - 1 camera offline (Sunter = emphasizes need for infrastructure)
> - This creates a narrative of "AI watching the city 24/7"

---

## Files to Modify

| File | Change |
|------|--------|
| `components/tiling/BottomTile.tsx` | Add CCTV tab + card grid + summary |
| (optional) `lib/constants.ts` | Move CCTV_CHANNELS here if reused |
| (optional) `app/cctv-simulation/page.tsx` | Update with real location data |
