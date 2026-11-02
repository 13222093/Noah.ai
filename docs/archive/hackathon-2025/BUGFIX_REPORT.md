# Bug Fix Report — Refactored Command Center

**Date**: 2026-03-11  
**Status**: ✅ All fixed — `npm run build` passes

---

## Summary

Fixed 12 bugs across 10 files in the refactored Command Center UI. Issues ranged from breaking production bugs (Tailwind JIT purge, data not reaching StatusBar) to UX flaws (dual-active nav, mobile overlap) and code quality improvements (dead CSS, non-deterministic mock data).

---

## 🔴 High Severity

### 1. Dual Active Nav Items — `NavRail.tsx`
Both **Command** and **Alerts** nav items glowed simultaneously when `activePanel === 'alerts'`.  
**Fix**: Command item now returns `false` from `isActive()` on the dashboard — it only navigates, it doesn't represent a panel.

### 2. Dynamic Tailwind Classes Purged — `CommandCenterView.tsx`
`getStatusColor().replace('text-', 'bg-')` produced class names at runtime (`bg-cc-critical`, etc.) that Tailwind JIT couldn't see → all status dots lost their background in production.  
**Fix**: New `getStatusBgColor()` function returns literal bg class names.

### 3. Stats Never Reach StatusBar — `StatusBar.tsx`, `CommandCenterView.tsx`, `layout.tsx`
`<StatusBar />` was rendered with no props. `floodZones` and `peopleAtRisk` always showed 0.  
**Fix**: Created `StatsContext` — `CommandCenterView` pushes stats on mount, `StatusBar` consumes them.

### 4. setTimeout Race Condition — `NavRail.tsx`
`setTimeout(() => setPanel(...), 100)` was fragile and not tied to navigation completion.  
**Fix**: Replaced with `pendingPanel` state + `useEffect` that fires when `pathname` becomes `/dashboard`.

---

## 🟠 Medium Severity

### 5. Full-Page Flash on Load — `useTheme.tsx`
`ThemeProvider` returned `null` until client-mounted, blanking the entire app.  
**Fix**: Renders children with `visibility: hidden` instead of `null` — DOM hydrates correctly, no flash.

### 6. Chatbot Overlaps Mobile Tab Bar — `CommandCenterView.tsx`
Chatbot button/window at `bottom-4` overlapped the 56px mobile bottom tab bar.  
**Fix**: `bottom-20 md:bottom-4` — pushed up on mobile, normal on desktop.

### 7. Non-Deterministic `peopleAtRisk` — `dashboard/page.tsx`
`reduce()` used `Math.random()` and ignored the current element → different value every revalidation.  
**Fix**: Uses `alert.estimatedPopulation || 2500` for deterministic results.

---

## 🟡 Low Severity

### 8. ML Health Hardcoded — `AIToolsPanel.tsx`
LSTM and YOLO always showed "Online" regardless of actual status.  
**Fix**: `useEffect` pings `/api/flood-predict` and `/api/cctv-scan` on mount, shows real status.

### 9. Missing `@keyframes float` — `globals.css`
`.floating` class referenced `animation: float` but the keyframes were only in `tailwind.config.ts` (not injected unless `animate-float` utility is used).  
**Fix**: Added `@keyframes float` directly in `globals.css`.

### 10. `high-contrast` Skipped in Toggle — `StatusBar.tsx`
Theme toggle cycled `light → dark → system` but skipped `high-contrast`.  
**Fix**: Added `'high-contrast'` to the themes array.

### 11. Dead CSS — `globals.css`
`.cc-layout--with-right-panel` was never applied (right panel is a flex child, not a grid column).  
**Fix**: Removed the dead rules.

### 12. Build Crash on `/flood-report` — `lib/supabase/client.ts`
`createBrowserClient` crashed during Next.js prerender because `NEXT_PUBLIC_SUPABASE_URL` was `undefined`.  
**Fix**: Fallback placeholder values instead of non-null assertions.

---

## Files Changed

| File | Bugs Fixed |
|------|-----------|
| `components/layout/NavRail.tsx` | #1, #4 |
| `components/layout/CommandCenterView.tsx` | #2, #3, #6 |
| `components/layout/StatusBar.tsx` | #3, #10 |
| `components/contexts/StatsContext.tsx` | #3 *(new file)* |
| `hooks/useTheme.tsx` | #5 |
| `app/dashboard/page.tsx` | #7 |
| `components/panels/AIToolsPanel.tsx` | #8 |
| `app/globals.css` | #9, #11 |
| `app/layout.tsx` | #3 *(StatsProvider wiring)* |
| `lib/supabase/client.ts` | #12 |

## Verification

- **TypeScript** (`tsc --noEmit`): ✅ Pass
- **Production Build** (`npm run build`): ✅ Pass
