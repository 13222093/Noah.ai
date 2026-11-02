# Region Selector — Implementation Report

> **Date:** 2026-03-12  
> **Scope:** Replace broken map search bar with cascading Provinsi → Kab/Kota → Kecamatan selector on top bar  
> **Status:** ✅ Complete (tsc exit code 0)

---

## Problem

The map's "Cari nama kota atau wilayah..." search bar (`FloodMap.tsx:603-625`) did not work — even on Floodzy. The geocoding-based search was unreliable. Floodzy's actual approach is a cascading dropdown via the `RegionDropdown` component backed by a Supabase API (`/api/regions`).

## Solution

Replaced the broken search bar with a **compact cascading region selector** on the TilingStatusBar. User picks Provinsi → Kabupaten/Kota → Kecamatan, and the map auto-flies to the selected district coordinates.

---

## Files Created

### `lib/locationStore.ts` — Zustand Store
Holds the selected region state (codes, names, lat/lng). Each level resets downstream:
- `setProvince(code, name)` → clears regency + district
- `setRegency(code, name)` → clears district
- `setDistrict(code, name, lat, lng)` → sets coordinates → triggers map pan

### `components/tiling/RegionSelector.tsx` — Compact Inline Selector
- 3 cascading `MiniSelect` dropdowns separated by `›` chevrons
- Each dropdown has a **search filter** input at the top
- Max height 192px with scrollbar
- Absolute-positioned dropdowns (z-9999)
- Blue highlight for active selection
- Shows `📍` pin icon and `✕` reset button
- Hidden on mobile (`hidden md:flex`)

---

## Files Modified

### `components/tiling/TilingStatusBar.tsx`
Added `<RegionSelector />` between the map layer buttons and the right controls (clock/theme/language):

```
[NOAH.AI] [Radar|AQI|Floods|Evac] | [📍 Provinsi › Kab/Kota › Kecamatan ✕] | [16:42 🌙 🌐]
```

### `components/map/FloodMap.tsx`
1. **Imported** `useLocationStore`
2. **Added auto-pan effect:**
   ```typescript
   const { latitude: regionLat, longitude: regionLng } = useLocationStore();
   useEffect(() => {
     if (regionLat != null && regionLng != null && mapRef.current) {
       mapRef.current.flyTo([regionLat, regionLng], 13, { duration: 1.2 });
     }
   }, [regionLat, regionLng]);
   ```
3. **Removed** the broken search bar overlay (23 lines of unused Input + Button)

---

## Data Flow

```
TilingStatusBar               FloodMap
      │                           │
  RegionSelector              useLocationStore()
      │                           │
  useRegionData()              regionLat / regionLng change
      │                           │
  /api/regions (Supabase)      map.flyTo([lat, lng], 13)
      │                           │
  useLocationStore.setDistrict()  ← same Zustand store
```

User picks Provinsi → API loads Kabupaten → User picks Kab → API loads Kecamatan → User picks Kecamatan → store gets lat/lng → FloodMap auto-pans.

---

## API Dependency

- **Endpoint:** `/api/regions?type=provinces|regencies|districts&parentCode=X`
- **Backend:** `app/api/regions/route.ts` → `fetchRegionsServer()` → Supabase
- **Data:** Indonesian government administrative boundaries with coordinates
- **Already existed:** Copied from Floodzy, fully functional

---

## Verification

`npx tsc --noEmit` → **exit code 0** ✅
