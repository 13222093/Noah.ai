# UX Audit Implementation Changelog

**Date**: March 11, 2026
**Scope**: 7 fixes from `COMMAND_CENTER_UX_AUDIT.md` — accessibility, crisis UX, and information density improvements.

---

## Changes Made

### P0 — Accessibility & Safety

#### Fix 1: Dynamic `<html lang>` (WCAG 3.1.2)
**Problem**: `layout.tsx:49` hardcoded `<html lang="en">`. The app has a full i18n system (Indonesian + English), but screen readers always used English text-to-speech — Indonesian content was unintelligible.

**Solution**: Created `HtmlLangSync.tsx` — a client component that syncs `document.documentElement.lang` with the active language via `useEffect`. Mounted in `ClientLayoutWrapper.tsx` inside `PanelProvider`.

**Files**: `[NEW] components/layout/HtmlLangSync.tsx`, `[MOD] components/layout/ClientLayoutWrapper.tsx`

---

#### Fix 2: "Last Updated" Timestamps
**Problem**: Zero freshness indicators on any panel. If Supabase drops silently, operators see stale data with no warning.

**Solution**: Created `useTimestamp.ts` hook — returns `{ markUpdated, timeAgo }` with auto-refresh every 30s. Wired into `CommandCenterView` (where fetches happen), passed `timeAgo` as props down to AlertPanel, DataPanel, and WeatherPanel headers.

**Architecture note**: DataPanel doesn't own its fetch — it receives data as props from CommandCenterView. So `markUpdated()` fires in CommandCenterView, not inside DataPanel. WeatherPanel has its own fetch, so it calls `markUpdated()` internally.

**Files**: `[NEW] hooks/useTimestamp.ts`, `[MOD] components/layout/CommandCenterView.tsx`, `[MOD] components/panels/PanelSwitcher.tsx`, `[MOD] components/panels/DataPanel.tsx`, `[MOD] components/panels/WeatherPanel.tsx`

---

### P1 — Motion & Crisis UX

#### Fix 3: `prefers-reduced-motion` Guard for JS Animations
**Problem**: CSS `@media (prefers-reduced-motion)` existed in `globals.css:458`, but `PeringatanBencanaCard.tsx` runs a `requestAnimationFrame` loop on `pointermove` — the CSS guard doesn't stop JavaScript animations.

**Solution**: Added `prefersReducedMotion` check via `useMemo(() => window.matchMedia(...).matches)` with SSR guard. The `useEffect` that attaches pointer event listeners now returns early if reduced motion is preferred — the RAF tilt loop is never registered.

**Files**: `[MOD] components/flood/PeringatanBencanaCard.tsx`

---

#### Fix 4: Severity Icon Shape Differentiation
**Problem**: `AlertTriangle` (danger) and `Bell` (warning) are nearly identical at small card sizes — poor rapid triage under stress.

**Solution**: Swapped to 3 distinct shapes: `ShieldAlert` (danger), `AlertCircle` (warning), `Info` (default). No dead `'critical'` tier added — PetaBencana.id API only emits `danger`, `warning`, and default.

**Files**: `[MOD] components/flood/PeringatanBencanaCard.tsx`

---

#### Fix 5: Water Level Sparklines
**Problem**: Water level posts show current value but no trend. For flood monitoring, "is it rising?" is more critical than the absolute number.

**Solution**: Created `Sparkline.tsx` — a 40×16px pure SVG component. Stroke color is automatic: `--cc-critical` (red) if rising, `--cc-safe` (green) if falling. Added to each water level card in DataPanel.

**Files**: `[NEW] components/ui/Sparkline.tsx`, `[MOD] components/panels/DataPanel.tsx`

---

### P2 — Information Density

#### Fix 6: Compact Sidebar Summary
**Problem**: Sidebar shows ONE panel at a time — operators must switch tabs to see weather + water levels + ML status.

**Solution**: Created `SidebarSummary.tsx` — a compact 2-row card always visible above `PanelSwitcher` in the desktop sidebar. Shows weather (temp + icon), highest water level post (value + trend arrow + status color), and ML health dots (LSTM ● Vision ●).

**Files**: `[NEW] components/panels/SidebarSummary.tsx`, `[MOD] components/layout/CommandCenterView.tsx`

---

#### Fix 7: Situation Summary Card
**Problem**: Alert feed starts with raw alert cards — no quick overview of "how bad is it?"

**Solution**: Added a natural language summary card at top of AlertPanel: "⚡ 3 critical, 2 warning" with top 3 affected locations. Generated from existing `alerts` array via `useMemo` — no new API call needed.

**Files**: `[MOD] components/layout/CommandCenterView.tsx`

---

## Bugs Found in Verification & Fixes

### Bug 1: Sparkline Visual Jitter (Fix 5)
**Symptom**: Sparklines showed different random values on every re-render — the "trend at a glance" purpose was undermined by constant visual noise.

**Root Cause**: `Math.random()` was called inline in JSX inside the `.map()` loop. Every state change in CommandCenterView triggered a cascade re-render, regenerating random noise each time.

**Fix**: Moved data generation into a `useMemo` that returns a `Map<string, number[]>` keyed on `post.id || post.name`, dependent on `waterLevelPosts`. Random noise is now generated once and stays stable.

**File**: `[MOD] components/panels/DataPanel.tsx`

---

### Bug 2: mlHealth Always Null (Fix 6)
**Symptom**: SidebarSummary's ML health row (LSTM ● Vision ●) never rendered — the green/yellow dots were silently missing.

**Root Cause**: `dashboard/page.tsx` built `initialData.stats` with only `{ totalRegions, activeAlerts, floodZones, peopleAtRisk }`. The `mlHealth` field didn't exist, so `initialData.stats?.mlHealth` was always `undefined → null`. SidebarSummary's `{mlHealth && (...)}` guard correctly hid the row — but the data was never populated.

**Fix**: Added server-side HEAD requests to `/api/flood-predict` and `/api/cctv-scan` in `dashboard/page.tsx` using `Promise.allSettled`. Results populate `mlHealth: { lstmReady, visionReady }` in `initialData.stats`. LSTM returns `true` if endpoint responds with `ok`, Vision returns `true` if `ok` or `405` (method not allowed = service exists but doesn't accept HEAD).

**File**: `[MOD] app/dashboard/page.tsx`

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` (pre-bugfix) | ✅ Exit 0 |
| `tsc --noEmit` (post-bugfix) | ✅ Exit 0 |

---

## Files Summary

| Status | File | Purpose |
|---|---|---|
| NEW | `components/layout/HtmlLangSync.tsx` | Syncs `<html lang>` with i18n |
| NEW | `hooks/useTimestamp.ts` | "Updated Xm ago" hook |
| NEW | `components/ui/Sparkline.tsx` | SVG sparkline for trends |
| NEW | `components/panels/SidebarSummary.tsx` | Always-visible sidebar summary |
| MOD | `components/layout/ClientLayoutWrapper.tsx` | Mounted HtmlLangSync |
| MOD | `components/layout/CommandCenterView.tsx` | Timestamps, SidebarSummary, SituationSummary |
| MOD | `components/panels/PanelSwitcher.tsx` | timeAgo prop passthrough |
| MOD | `components/panels/DataPanel.tsx` | Sparklines + timestamp display |
| MOD | `components/panels/WeatherPanel.tsx` | Own timestamp after fetch |
| MOD | `components/flood/PeringatanBencanaCard.tsx` | Reduced motion + icon shapes |
| MOD | `app/dashboard/page.tsx` | mlHealth in initialData.stats |
