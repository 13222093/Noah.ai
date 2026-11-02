# noah.ai — Path to 10/10 (Revised)

Updated based on code review feedback. Verified fixes, corrected plan errors, added missing items.

---

## Already Fixed This Session ✅

| # | Bug | Proof |
|---|-----|-------|
| Stale chat history | `CommandCenterView.tsx:309` → `history: newHistory` |
| useMediaQuery infinite re-render | `useMediaQuery.ts:16` → dep array `[query]` only |
| Hardcoded API key | `chatbot/route.ts:38` → env var only |
| Stack trace leak | `ai-alerts/route.ts` → removed `stack` field |
| getBaseUrl hardcoded domain | `utils.ts` → uses `VERCEL_URL` dynamically |
| SSRF in tile route | Regex validation added |
| Wrong proxy endpoints | `/api/water-level` and `/api/pump-status` |
| Personal email in User-Agent | Replaced with `noah.ai/1.0` |
| Weather crash guard | `?.main` guard before `.temp` |
| geocodingService placeholder | Rewrote with real API calls via env var |

---

## Remaining Fixes — Priority Order

### 1. WCAG text size (2 min) — Visual +0.3
- **File:** `components/flood-map/FloodReportCard.tsx:91`
- **Change:** `text-[0.55rem]` → `text-xs`

### 2. Add HarmCategory safety filters to ai-alerts (5 min) — AI +0.5
- **File:** `app/api/ai-alerts/route.ts` (~line 216)
- **Change:** Add same `safetySettings` array from `flood-analysis/route.ts:101-118`

### 3. Sanitize prompt injection in flood-analysis (5 min) — AI +0.3
- **File:** `app/api/flood-analysis/route.ts:125`
- **Change:** Strip backticks, limit to 500 chars, wrap in `<user_request>` boundary

### 4. Gate ML demo-mode endpoint (5 min) — AI +0.5
- **File:** `ml-service/src/main.py:98-114`
- **Change:** Check `X-Admin-Secret` header against `ADMIN_SECRET` env var

### 5. `[DATA SIMULASI]` badge (10 min) — Functionality +0.5, AI Transparency +0.2
- **Files:** `CommandCenterView.tsx` data panels (water levels, pump status, alerts sections) — NOT just BottomTile
- **Why:** Mock data originates in `dashboard/page.tsx` and flows into CommandCenterView. Badge must be visible in the default layout too, not just `?layout=tiling`

### 6. In-memory rate limiter on AI endpoints (10 min) — AI +0.4
- **New File:** `lib/simple-rate-limit.ts` (Map-based, no Redis needed)
- **Wire into:** `chatbot/route.ts`, `ai-alerts/route.ts`, `flood-analysis/route.ts`

### 7. Add data privacy consent note (5 min) — AI +0.3
- Add brief text in chatbot initial message or `/about` page
- "noah.ai sends anonymized location data to OpenWeatherMap & Google Gemini for weather/AI features. No personal data is stored."

### 8. Fix StatsContext + AlertCountContext inline values (5 min) — Functionality
- **Files:** `StatsContext.tsx:27`, `AlertCountContext.tsx:98`
- **Change:** Wrap provider value objects in `useMemo` to prevent cascading re-renders

### 9. i18n — wrap hardcoded strings in 4 components (20 min) — Visual +0.8
- `FloodAlert.tsx` — scan for hardcoded Indonesian
- `FloodReportCard.tsx` — "Laporan", "Lokasi", etc.
- `CommandMenu.tsx` — labels
- MapControls — labels
- Add keys to `src/i18n/id.ts` + `src/i18n/en.ts`

### 10. CommandCenterView t() calls (10 min) — Visual +0.3
- Wrap visible UI text: section headers, tooltips, status labels

### 11. CCTV label polish (10 min) — Functionality +0.5
- Remove "(Placeholder)" from channel labels in `lib/constants.ts`
- Use real Jakarta intersection names

### 12. Mock data fallback with correct logic (10 min) — Functionality +0.3
- **File:** `app/dashboard/page.tsx`
- **Correct approach:** Attempt real Supabase fetch → if fails or returns empty → fall back to mock + set `isSimulated = true` flag → pass flag to components for badge display

### ~~Thai stub~~ — REMOVED
> Reviewer correctly flagged: machine-translated Thai with wrong register/honorifics would hurt more than help without a Thai reviewer.

---

## Revised Priority Order

| # | Fix | Time | Score Impact |
|---|-----|------|-------------|
| 1 | WCAG text fix | 2 min | Visual +0.3 |
| 2 | HarmCategory filters | 5 min | AI +0.5 |
| 3 | Prompt sanitization | 5 min | AI +0.3 |
| 4 | Demo-mode gate | 5 min | AI +0.5 |
| 5 | DATA SIMULASI badge | 10 min | Func +0.5, AI +0.2 |
| 6 | Rate limiter | 10 min | AI +0.4 |
| 7 | Privacy notice | 5 min | AI +0.3 |
| 8 | Context useMemo | 5 min | Func +0.2 |
| 9 | i18n strings (4 files) | 20 min | Visual +0.8 |
| 10 | CCView t() calls | 10 min | Visual +0.3 |
| 11 | CCTV label polish | 10 min | Func +0.5 |
| 12 | Mock data fallback | 10 min | Func +0.3 |

**Total: ~1.5 hours**

---

## Verification Plan (Expanded)

1. `npx tsc --noEmit` — compile check
2. Language toggle EN ↔ ID — no hardcoded strings visible
3. **Demo flows to test:**
   - Chatbot: multi-turn with tool calling (weather, location)
   - `/flood-predict` → auto-predict mode
   - Smart-alert chain endpoint
   - CCTV page → all labels correct
4. Mobile viewport — no text below 12px
5. Resize browser — no infinite re-render (useMediaQuery fixed)
6. Check error responses — no stack traces
