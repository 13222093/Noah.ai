# Sub-Page i18n & Bug Fix Plan

5 pages need i18n wiring, 1 has an icon logic bug. Ordered by judge impact.

---

## Fix 1: `/alerts/page.tsx` — HIGHEST PRIORITY
**Problem:** `t` is destructured at line 66 but never called. ~20 hardcoded Indonesian strings. NEWS_ITEMS URLs point to domain roots, not real articles.

**Changes:**
- Wire `t()` into all stat card labels (`Total Peringatan`, `Tingkat Tinggi`, etc.)
- Wire `t()` into tab labels (`Peringatan`, `Berita Regional`)
- Wire `t()` into card content (`Wilayah Terdampak:`, `Kembali`, header title)
- Wire `t()` into `getLevelBadge()` labels (`TINGGI`, `SEDANG`, `RENDAH`)
- Fix NEWS_ITEMS urls → use real article search links (e.g. `https://www.kompas.com/tag/banjir`)
- **Keys:** Reuse existing `warnings.*` keys where possible, add missing ones

---

## Fix 2: `/flood-predict/page.tsx` — HIGH PRIORITY
**Problem:** `t` destructured at line 54, never called. ~25 hardcoded English strings.

**Changes:**
- Wire `t()` into PageShell title/subtitle 
- Wire `t()` into mode buttons (`Auto (Live)`, `Manual`, `Demo Scenario`)
- Wire `t()` into labels (`Input Data`, `Rainfall Bogor (mm)`, `Current Water Level (cm)`)
- Wire `t()` into result labels (`Predicted Water Level`, `Risk Level`, `Recommendation`)
- Wire `t()` into button text (`Predicting...`, `Auto Predict (Live Data)`, `Get Prediction`)
- Wire `t()` into status badges (`LSTM: Ready/Offline`, `YOLO: Ready/Offline`)
- **New keys:** Add `floodPredict.*` section to both `id.ts` and `en.ts`

---

## Fix 3: `/visual-verify/page.tsx` — ICON BUG + i18n
**Problem:** CheckCircle icon for flood detection (line 168-170) is semantically wrong. Also ~10 hardcoded English strings and no i18n.

**Changes:**
- **Bug fix:** Change `CheckCircle` (red) → `AlertTriangle` (red) when `is_flooded === true`
- Keep `CheckCircle` (green) for "no flood" — that's correct
- Wire `t()` into PageShell title/subtitle and all labels
- **New keys:** Add `visualVerify.*` section to both `id.ts` and `en.ts`

---

## Fix 4: `/cctv-simulation/page.tsx` — MIXED LANGUAGE
**Problem:** No i18n at all. Mix of Indonesian ("Banjir Terdeteksi", "Objek Terdeteksi") and English ("Confidence", "Flood Probability").

**Changes:**
- Add `useLanguage()` import and `t` destructure
- Wire `t()` into PageShell title/subtitle
- Wire `t()` into summary bar, card labels, status badges
- **New keys:** Add `cctvSimulation.*` section to both `id.ts` and `en.ts`

---

## Fix 5: `/sms-subscribe/page.tsx` — LOW PRIORITY
**Problem:** No i18n. All Indonesian. Functional page, least judge-visible.

**Changes:**
- Add `useLanguage()` import and `t` destructure
- Wire `t()` into form labels, buttons, title
- **New keys:** Add `smsSubscribe.*` section to both `id.ts` and `en.ts`

---

## Translation Key Strategy

All new keys go into both `src/i18n/id.ts` and `src/i18n/en.ts`. Using nested namespaces:

| Namespace | Est. keys |
|-----------|----------|
| `warnings.*` (reuse) | ~5 existing |
| `floodPredict.*` (new) | ~20 |
| `visualVerify.*` (new) | ~10 |
| `cctvSimulation.*` (new) | ~10 |
| `smsSubscribe.*` (new) | ~8 |

**Total: ~48 new keys across both files**

---

## Priority Order

| # | Page | Time | Impact |
|---|------|------|--------|
| 1 | /alerts | 15 min | High — judge will toggle language here |
| 2 | /flood-predict | 15 min | High — most strings, technical page |
| 3 | /visual-verify | 10 min | Medium — icon bug is visible |
| 4 | /cctv-simulation | 10 min | Medium — mixed language looks sloppy |
| 5 | /sms-subscribe | 5 min | Low — rarely visited |

**Total: ~55 min**

---

## Verification
1. `npx tsc --noEmit` — clean compilation
2. Toggle EN ↔ ID on each page — no hardcoded strings visible
3. Visual-verify: flood result shows AlertTriangle (red), clear shows CheckCircle (green)
