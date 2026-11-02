# UX Audit Implementation — Session Postmortem

**Date**: March 11, 2026
**Duration**: ~4 hours
**Scope**: 7 UX fixes + NavRail debugging

---

## What We Set Out to Do

Implement 7 prioritized fixes from `COMMAND_CENTER_UX_AUDIT.md`:

| Priority | Fix | Goal |
|---|---|---|
| P0 | Dynamic `<html lang>` | WCAG 3.1.2 compliance |
| P0 | Data freshness timestamps | "Updated Xm ago" on all panels |
| P1 | `prefers-reduced-motion` guard | Stop JS animation for accessibility |
| P1 | Icon shape differentiation | Distinct shapes for severity levels |
| P1 | Sparkline trends | Visual water level direction |
| P2 | Sidebar summary | Always-visible weather/water/ML health |
| P2 | Situation summary | Natural language alert digest |

---

## What We Actually Built

### New Files (4)
- `components/layout/HtmlLangSync.tsx` — syncs `<html lang>` with i18n
- `hooks/useTimestamp.ts` — reusable "Updated Xm ago" hook
- `components/ui/Sparkline.tsx` — pure SVG sparkline (40×16px)
- `components/panels/SidebarSummary.tsx` — compact sidebar summary card

### Modified Files (8)
- `ClientLayoutWrapper.tsx` — mounted HtmlLangSync
- `CommandCenterView.tsx` — timestamps, SidebarSummary, situation summary
- `PanelSwitcher.tsx` — timeAgo prop passthrough
- `DataPanel.tsx` — sparklines + timestamp display
- `WeatherPanel.tsx` — own timestamp after fetch
- `PeringatanBencanaCard.tsx` — reduced motion guard + icon shapes
- `dashboard/page.tsx` — mlHealth HEAD checks
- `NavRail.tsx` — rewrote handleNavClick logic

---

## Bugs Found During Verification

### Bug 1: Sparkline Visual Jitter
- **What**: Sparklines showed different random values on every re-render
- **Root cause**: `Math.random()` called inline in JSX inside `.map()` loop
- **Fix**: Moved to `useMemo` returning `Map<string, number[]>` keyed on `waterLevelPosts`
- **Time to fix**: ~5 minutes
- **Lesson**: Never call nondeterministic functions inline in JSX

### Bug 2: mlHealth Always Null
- **What**: SidebarSummary ML health dots never rendered
- **Root cause**: `dashboard/page.tsx` only built `stats: { totalRegions, activeAlerts, floodZones, peopleAtRisk }` — mlHealth wasn't in the object
- **Fix**: Added server-side HEAD requests to `/api/flood-predict` and `/api/cctv-scan`, populated `mlHealth: { lstmReady, visionReady }`
- **Time to fix**: ~5 minutes
- **Lesson**: When designing a component that depends on data, verify the data actually exists upstream

### Bug 3: NavRail Command Button Broken
- **What**: Clicking "Command" didn't navigate to `/dashboard` from other pages
- **Root cause**: Complex — see detailed breakdown below
- **Time to fix**: ~45 minutes (should have been 5)
- **This is where the session went wrong**

---

## The NavRail Debugging Disaster — What Went Wrong

### The Actual Problem
The `handleNavClick` function in `NavRail.tsx` had convoluted logic with 5+ branching conditions. When we added `href` properties to nav items (Alerts→`/alerts`, Data→`/sensor-data`, Weather→`/current-weather`), the interaction between `isDashboard`, `item.panelId`, `item.href`, and `item.id === 'command'` created dead code paths.

### The Original Logic (pre-session)
```
if (isDashboard && item.panelId) → swap panel, return
if (item.id === 'command') → navigate /dashboard, return
if (item.panelId) → navigate /dashboard + setPendingPanel, return
if (item.href) → navigate to href
```
Nav items had NO href (except Command), so everything was panel-swap on dashboard.

### What We Changed
We added `href` to Data, Alerts, Weather so they'd navigate to dedicated pages instead of only swapping sidebar panels. But this broke the logic because:
1. First check `isDashboard && item.panelId` caught Command (which has panelId) before it could navigate
2. We added `!item.href` guard, but then Command fell through to `item.href` which did `router.push('/dashboard')` — a same-route no-op on dashboard
3. Multiple patches made the branching worse, not better

### Why It Took So Long
1. **Ran 3 browser test sessions** instead of reading the 30 lines of code carefully
2. **Misinterpreted browser test results** — the subagent reported "SUCCESS" while screenshots showed the page hadn't actually changed
3. **Patched incrementally** instead of rewriting — added `if (isDashboard && item.id === 'command')` as a special case, then `!item.href` guards, creating a 5-deep conditional chain where each fix broke another branch
4. **Didn't verify my own screenshots** — accepted the browser subagent's text report instead of looking at the actual images

### The Fix (What Should Have Been Done First)
Rewrote `handleNavClick` as 3 clean branches:
```typescript
// 1. Command: always /dashboard (or reset panel if already there)
if (item.id === 'command') {
  if (isDashboard) setPanel('alerts');
  else handleNavigate('/dashboard');
  return;
}
// 2. Items with href: always navigate
if (item.href) { handleNavigate(item.href); return; }
// 3. Panel-only items: swap panel or navigate to dashboard
if (item.panelId) {
  if (isDashboard) setPanel(item.panelId);
  else { handleNavigate('/dashboard'); setPendingPanel(item.panelId); }
}
```
**30 lines. No ambiguity. No dead branches.**

---

## Time Breakdown

| Phase | Time | Notes |
|---|---|---|
| P0 implementation (Fixes 1-2) | ~30 min | Clean, no issues |
| P1 implementation (Fixes 3-5) | ~20 min | Clean |
| P2 implementation (Fixes 6-7) | ~25 min | Minor TS type fix for CombinedWeatherData |
| Verification + Bug 1-2 fixes | ~15 min | Fast — obvious bugs |
| **NavRail debugging** | **~45 min** | **3 browser tests, multiple patches, misread screenshots** |
| Documentation | ~15 min | — |

The NavRail debug consumed **30% of the session** for a problem that required a **30-line rewrite**.

---

## Lessons Learned

### 1. Read the Code Before Running Tests
Three browser test sessions were run before the `handleNavClick` function was carefully read. The function is 30 lines long. Reading it would have revealed the bug in 2 minutes.

### 2. Rewrite > Patch for Tangled Logic
The original `handleNavClick` had organic complexity — conditions added over time for different edge cases. Each patch we applied added another `if` branch, making the function harder to reason about. The rewrite into 3 clean branches took 2 minutes and had zero bugs.

### 3. Don't Trust Text Reports, Verify Screenshots
The browser subagent reported "SUCCESS" while screenshots clearly showed the page hadn't navigated. Always verify visual evidence over text summaries.

### 4. Inline Nondeterminism Is Always a Bug
`Math.random()` in JSX looks harmless in a `.map()` loop but fires on every render. Always memoize nondeterministic computations.

### 5. Verify Data Flow End-to-End
The `mlHealth` bug happened because we designed `SidebarSummary` to consume `mlHealth` from `initialData.stats` without checking that `dashboard/page.tsx` actually provided it. Always trace the data from source to sink before writing the consumer.

### 6. Check How Types Are Shaped
The `CombinedWeatherData` type error (`weatherData.temperature` doesn't exist) happened because we assumed a flat structure. The actual type was `{ current: { main: { temp } } }`. Check the interface definition first.
