# UX Audit Implementation Plan

8 items from `COMMAND_CENTER_UX_AUDIT.md`. Ordered by priority.

---

## P0 — Accessibility & Safety (2 fixes, ~35 min)

### Fix 1: Dynamic `<html lang>` from i18n

#### [MODIFY] [layout.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/app/layout.tsx)
- `<html lang="en">` → `<html lang="en">` stays as server default (SSR needs a value)

#### [NEW] [HtmlLangSync.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/layout/HtmlLangSync.tsx)
- Client component that reads `useLanguage()` and sets `document.documentElement.lang` via `useEffect`
- Mount in `ClientLayoutWrapper` (already wraps children in `layout.tsx`)
- ~15 lines

---

### Fix 2: "Last Updated" Timestamps on Panels

#### [NEW] [useTimestamp.ts](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/hooks/useTimestamp.ts)
- Hook: `useTimestamp()` returns `{ lastUpdated: Date | null, markUpdated: () => void, timeAgo: string }`
- `timeAgo` auto-updates every 30s ("Just now" → "1 min ago" → "5 min ago")

#### [MODIFY] [CommandCenterView.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/layout/CommandCenterView.tsx)
- **Key**: `markUpdated()` fires HERE — where fetches happen (useWeatherData, useDisasterData, alert fetch)
- Pass `timeAgo` strings down as props to panels:
  - `alertsTimeAgo` → AlertPanel header
  - `dataTimeAgo` → DataPanel (receives as prop, not own fetch)
  - `weatherTimeAgo` → WeatherPanel header

#### [MODIFY] [WeatherPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/panels/WeatherPanel.tsx)
- Accept `timeAgo?: string` prop, show `Updated {timeAgo}` next to title
- **Note**: WeatherPanel has its own fetch — can also call `markUpdated()` internally

#### [MODIFY] [DataPanel.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/panels/DataPanel.tsx)
- Accept `timeAgo?: string` prop, show next to "Water Levels" / "Pump Stations" headers
- **Does NOT own fetch** — timestamp comes from CommandCenterView via props

---

## P1 — Motion Accessibility & Crisis UX (3 fixes, ~1.5 hrs)

### Fix 3: `useReducedMotion()` Guards

Currently only `card.tsx` uses it. 15 other Framer Motion components don't.

#### [MODIFY] [PeringatanBencanaCard.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/flood/PeringatanBencanaCard.tsx)
- Add `matchMedia('(prefers-reduced-motion: reduce)')` check at top of component
- If reduced motion preferred: skip all `addEventListener` calls for pointer events, disable `requestAnimationFrame` loop
- Card still renders, just no 3D tilt animation

#### Framer Motion components — batch fix
Add `useReducedMotion()` and conditionally disable `animate` props in:
- `WeatherMap.tsx`, `WeatherDisplay.tsx`, `loading-spinner.tsx`, `badge.tsx`
- `DataSensorClientContent.tsx`, `Sidebar.tsx`, `SplashScreen.tsx`, `Header.tsx`
- `DashboardClientPage.tsx`, `MapLegend.tsx`, `MapControls.tsx`, `FloodMap.tsx`
- `FloodAlert.tsx`, `InfrastructureStatusCard.tsx`, `DashboardStats.tsx`

**Approach**: For each, import `useReducedMotion`, set `animate={shouldReduce ? false : originalAnimate}`. Using `false` (not `{}`) — empty object can cause initial render flash. Loading spinner exempted (functional, not decorative).

---

### Fix 4: Severity Icon Shape Variety

#### [MODIFY] [PeringatanBencanaCard.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/flood/PeringatanBencanaCard.tsx#L37-L46)
- Swap icon shapes for better differentiation (PetaBencana.id only emits `danger`, `warning`, default):
```tsx
case 'danger':   return <ShieldAlert />;    // was AlertTriangle — more alarming shape
case 'warning':  return <AlertCircle />;    // was Bell — distinct from danger
default:         return <Info />;           // unchanged
```
- Import `ShieldAlert`, `AlertCircle` from lucide-react (drop `Bell`)
- **No 'critical' case** — PetaBencana.id API doesn't emit it, would be dead code

---

### Fix 5: Water Level Sparklines

#### [NEW] [Sparkline.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/ui/Sparkline.tsx)
- Tiny SVG sparkline component: `<Sparkline data={[120, 135, 142, 150, 148]} />`
- 40×16px, pure SVG — no chart library
- **Explicit trend coloring**: `cc-critical` stroke if `data[last] > data[first]` (rising = danger), `cc-safe` if falling (receding = good). This is the entire UX value — "is it rising?"
- ~30 lines

#### [MODIFY] [CommandCenterView.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/layout/CommandCenterView.tsx) (WaterLevelsStrip)
- Add `<Sparkline />` next to each water level value
- Data: use mock 6-point history (real API doesn't provide historical per-post)

---

## P2 — Information Density (2 fixes, ~1 hr)

### Fix 6: Compact Sidebar Summary

#### [NEW] [SidebarSummary.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/panels/SidebarSummary.tsx)

**Props signature** (must be defined before implementation):
```tsx
interface SidebarSummaryProps {
  weatherData: { temperature?: number; condition?: string; icon?: string } | null;
  topWaterPost: { name: string; level: number; status: string } | null;
  mlHealth: { lstmReady: boolean; visionReady: boolean } | null;
}
```

- Compact 2-row card:
  - Row 1: weather temp + icon | highest water level + trend arrow
  - Row 2: ML health inline badges (LSTM ● Vision ●)
- Always visible above `<PanelSwitcher />` — gives context without panel switching
- All data sourced from CommandCenterView (no own fetch)

#### [MODIFY] [CommandCenterView.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/layout/CommandCenterView.tsx)
- Thread `weatherData`, `topWaterPost`, `mlHealth` as props to `<SidebarSummary />`
- Render above `<PanelSwitcher />` in desktop layout

---

### Fix 7: Situation Summary Card

#### [MODIFY] [CommandCenterView.tsx](file:///c:/Users/Ari%20Azis/Hackathon2025/Floods/flood/components/layout/CommandCenterView.tsx) (AlertPanel)
- Add 2-line natural language summary at top of alert feed:
  - "⚡ {n} critical alerts — {top locations}"
  - "Water rising in {n} zones. ML: {status}"
- Generated from existing `alerts` array + `stats` context — no new API

---

## P3 — Advanced (1 fix, 2+ hrs — optional)

### Fix 8: Time-Based Slider

Deferred — requires backend historical data API that doesn't exist yet. Document as future roadmap item.

---

## Verification Plan

1. `npx tsc --noEmit` — exit 0
2. `npm run build` — exit 0
3. Browser test: switch language → verify `<html lang>` updates
4. Browser test: wait 60s → verify "Updated X min ago" appears on panels
5. Browser test: check `prefers-reduced-motion` → verify no 3D tilt on cards
