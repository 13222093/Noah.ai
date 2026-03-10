# Command Center UI/UX Refactor Plan (v2)

> Revised with Opus UI/UX feedback. This is the definitive plan for refactoring Noah.ai from a sidebar multi-page app into a command center.

---

## Design Decisions (Locked In)

| Decision | Answer |
|---|---|
| Panel behavior | **Swap right sidebar content** — nav rail clicks replace right panel contents |
| Map persistence | **Always visible** — map is the permanent centerpiece |
| Mobile | **Build both** desktop and mobile views |
| Font | **Space Grotesk** (headings/UI) + **JetBrains Mono** (data/numbers) |
| Scope | **All 4 phases** |
| Splash screen | **Kill it** — contradicts mission control ethos |

---

## Tier System

### 🔴 Tier 1: Always Visible

| Element | Position | Details |
|---|---|---|
| **Map** | Center (full height, full width of main area) | Leaflet with flood markers, prediction layer, evacuation markers |
| **Alert Feed** | Right sidebar (280px, default view) | Real-time alerts, severity badges, scrollable |
| **Status Bar** | Top (48px) | Alert counts, flood zones, people at risk, ML health, weather chip |
| **Water Levels** | Bottom strip below map (compact) | Key monitoring posts with level + trend arrows (Manggarai, Katulampa, etc.) |
| **AI Chat** | Bottom-right floating | Gemini chatbot, minimized/expandable |
| **Evacuation Markers** | On the map itself | Persistent markers, NOT hidden behind a click |

### 🟡 Tier 2: One-Click (Swaps Right Sidebar or Modal)

| Panel | Trigger | Type |
|---|---|---|
| **Evacuation Detail** | Click evacuation map marker | Swap right sidebar |
| **Pump Status** | Nav rail "Data" | Swap right sidebar |
| **Weather Detail** | Click weather chip in status bar | Swap right sidebar |
| **Alert Detail + AI Analysis** | Click alert card | Swap right sidebar |
| **CCTV Feeds** | Nav rail "AI Tools" → CCTV | Swap right sidebar (expand-to-fullscreen option) |
| **Report Flood** | Quick action button | Modal over map |
| **SMS Subscribe** | Quick action button | Modal |

### 🟢 Tier 3: Full Pages (Navigate Away)

| Page | Nav Rail Group |
|---|---|
| LSTM Prediction | AI Tools |
| Visual Verify (YOLO) | AI Tools |
| Statistics | More |
| Education (+ sub-pages) | More |
| Settings | More |
| Contact / Privacy / Data Source / About | More |

---

## Layout

### Desktop (≥1280px)

```
┌──────┬──────────────────────────────────────┬──────────────────┐
│ NAV  │  STATUS BAR (48px)                   │                  │
│ RAIL │  🔴 3 High │ ⚠️ 12 Active │ 👥 14.8K │ 🧠 LSTM ✅ │ 🌤 28°│
│ 60px ├──────────────────────────────────────┼──────────────────┤
│      │                                      │  ⚠️ ALERT FEED   │
│  🏠  │                                      │  280px           │
│ Cmd  │           🗺️ MAP                     │                  │
│      │         (Main Area)                  │  🔴 Katulampa    │
│  ⚠️  │                                      │  210cm ⬆️ Siaga 1│
│ Alert│    Flood markers                     │                  │
│      │    Evacuation markers (persistent)   │  🟡 Manggarai    │
│  📊  │    Prediction heatmap layer          │  850cm ⬆️ Siaga 3│
│ Data │                                      │                  │
│      │                                      │  🔴 Waduk Pluit  │
│  🔮  │                                      │  Pompa aktif     │
│ AI   │                                      │                  │
│      ├──────────────────────────────────────┤  🟢 Angke Hulu   │
│  ⚙️  │ 💧 WATER LEVELS (compact strip)      │  150cm Normal    │
│ More │ Manggarai 850cm ⬆️ │ Katulampa 210cm │                  │
│      │ Karet 420cm ➡️    │ Ancol 180cm ⬇️   │  ─── Quick ───   │
│      │                                      │  [📝 Report]     │
│      │                                      │  [📱 SMS]        │
└──────┴──────────────────────────────────────┴──────────────────┘
                               🤖 AI Chat (floating)
```

**Grid CSS:**
```css
.command-center {
  display: grid;
  grid-template-columns: 60px 1fr 280px;
  grid-template-rows: 48px 1fr;
  height: 100vh;
  overflow: hidden;
  gap: 0;  /* outer shell: no gap */
}

.main-content {
  grid-column: 2;
  grid-row: 2;
  position: relative;  /* map fills this */
}

.right-panel {
  grid-column: 3;
  grid-row: 1 / -1;   /* full height */
  border-left: 1px solid var(--border-subtle);
  overflow-y: auto;
}
```

### Mobile (< 768px)

```
┌─────────────────────────┐
│ ━━ STATUS BAR ━━━━━━━━ │
│ 🔴 3 │ ⚠️ 12 │ 🌤 28° │
├─────────────────────────┤
│                         │
│    🗺️ MAP (40vh)        │
│    (pull-to-expand)     │
│                         │
├─────────────────────────┤
│ 💧 Manggarai 850 ⬆️│ Ka…│
│   (horizontal scroll)   │
├─────────────────────────┤
│ ⚠️ ALERT FEED (scroll) │
│ 🔴 Katulampa - Siaga 1 │
│ 🟡 Manggarai - Siaga 3 │
│ 🔴 Waduk Pluit         │
├─────────────────────────┤
│ [📝 Report]  [📱 SMS]  │
├─────────────────────────┤
│  🏠   ⚠️   📊   🔮   ⚙️  │ ← Bottom tab bar
└─────────────────────────┘
```

- Map: **40vh** (not 60vh — leaves room on iPhone SE)
- Pull-to-expand gesture for map
- Bottom tab bar (5 items, thumb zone friendly)

---

## Nav Rail: 5 Items

| # | Icon | Label | Action |
|---|---|---|---|
| 1 | 🏠 | Command | Return to command center default view |
| 2 | ⚠️ | Alerts | Swap right panel → alert list + detail |
| 3 | 📊 | Data | Swap right panel → water levels + pump status + sensor data |
| 4 | 🔮 | AI Tools | Swap right panel → LSTM, YOLO, CCTV options (with links to full pages) |
| 5 | ⚙️ | More | Overflow menu → Statistics, Education, Settings, Contact, Privacy, About |

---

## Visual Identity

### Color System

```css
:root {
  /* Base */
  --bg-primary: #0a0e1a;        /* Deep navy */
  --bg-surface: #111827;        /* Panel background */
  --bg-elevated: #1a2236;       /* Elevated surface */
  --border-subtle: #1e293b;     /* Panel borders */
  --border-active: #00e5ff33;   /* Glow border (20% opacity) */

  /* Cyan Scale (avoids visual fatigue) */
  --cyan-active: #00e5ff;       /* Active state, primary accent */
  --cyan-hover: #4dd0e1;        /* Hover state */
  --cyan-inactive: #26506a;     /* Inactive/muted */
  --cyan-glow: #00e5ff1a;       /* Background glow (10% opacity) */

  /* Semantic */
  --alert-critical: #ff1744;    /* Red — critical alerts */
  --alert-warning: #ff3d00;     /* Orange-red — warnings (not amber) */
  --alert-caution: #ff9100;     /* Orange — moderate */
  --alert-safe: #00e676;        /* Green — normal */

  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #475569;
}
```

### Typography

```css
/* Headings & UI */
font-family: 'Space Grotesk', sans-serif;

/* Data, numbers, status values */
font-family: 'JetBrains Mono', monospace;
```

### Panel Styling

```css
.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;           /* sharper than current xl */
  gap: 8px;                     /* minimum gap between panels */
}

.panel:hover, .panel.active {
  border-color: var(--border-active);
  box-shadow: 0 0 12px var(--cyan-glow);
}
```

---

## Error & Loading States

> Opus flagged: no loading/error strategy defined. Fixed:

| State | Behavior |
|---|---|
| **Loading** | Skeleton pulse animation per-panel (not full page spinner) |
| **Error** | Red-tinted panel with retry button + error message. Never blank. |
| **Partial fail** | Working panels render normally, failed panels show error independently |
| **Reconnecting** | Status bar shows "Reconnecting..." with pulse indicator |

---

## Accessibility Fixes (P0)

| Issue | Fix |
|---|---|
| `lang="id"` hardcoded | Set dynamically from `LanguageContext` |
| No skip-to-content | Add `<a href="#main" class="sr-only focus:not-sr-only">` |
| `transition: all` on `*` | Remove global transition, apply selectively |
| No `prefers-reduced-motion` | Add media query to disable animations |
| Alert colors only | Add icon + text alongside color badges |

---

## Phased Implementation

### Phase 1: Layout Shell
**Impact:** Everything visual changes. This is the highest-impact phase.

| File | Action | Description |
|---|---|---|
| `components/layout/ClientLayoutWrapper.tsx` | **Rewrite** | Command center grid (nav rail + status bar + main + right panel) |
| `components/layout/Sidebar.tsx` | **Replace** → `NavRail.tsx` | 5-item icon rail, 60px wide |
| `components/layout/Header.tsx` | **Replace** → `StatusBar.tsx` | 48px bar with stats, weather chip, ML health |
| `app/globals.css` | **Update** | New CSS variables, grid system, panel styles |
| `tailwind.config.ts` | **Update** | Space Grotesk + JetBrains Mono, new color tokens |
| `app/layout.tsx` | **Update** | Load new fonts, remove splash screen |
| `components/layout/SplashScreen.tsx` | **Delete** | Kill the 6-second splash |

### Phase 2: Command Center Dashboard
**Impact:** The main view users see.

| File | Action | Description |
|---|---|---|
| `app/dashboard/page.tsx` | **Rewrite** | Server component feeding command center view |
| `components/layout/DashboardClientPage.tsx` | **Decompose** | Extract into panel components |
| `components/panels/AlertPanel.tsx` | **New** | Right sidebar default: alert feed + quick actions |
| `components/panels/StatusBar.tsx` | **New** | Top bar: stats, weather chip, ML status |
| `components/panels/MapPanel.tsx` | **New** | Persistent map with all layers + evacuation markers |

### Phase 3: Panel System (Tier 2)
**Impact:** Feature access patterns.

| File | Action | Description |
|---|---|---|
| `components/panels/DataPanel.tsx` | **New** | Water levels + pump status (swaps right sidebar) |
| `components/panels/WeatherDetailPanel.tsx` | **New** | Full weather (swaps right sidebar) |
| `components/panels/AlertDetailPanel.tsx` | **New** | Alert + AI analysis (swaps right sidebar) |
| `components/panels/EvacuationDetailPanel.tsx` | **New** | Evacuation location detail (swaps right sidebar) |
| `components/panels/CCTVPanel.tsx` | **New** | CCTV feeds (swaps right sidebar) |
| `components/modals/ReportFloodModal.tsx` | **New** | Flood report form as modal |
| `components/modals/SMSSubscribeModal.tsx` | **New** | SMS subscribe as modal |
| `components/panels/PanelSwitcher.tsx` | **New** | Orchestrates which panel shows in right sidebar |

### Phase 4: Restyle Tier 3 Pages

| File | Action | Description |
|---|---|---|
| `app/flood-predict/page.tsx` | **Restyle** | Apply command center theme, add "back to CC" nav |
| `app/visual-verify/page.tsx` | **Restyle** | Same |
| `app/statistics/page.tsx` | **Restyle** | Same |
| `app/education/page.tsx` | **Restyle** | Same |
| `app/settings/page.tsx` | **Restyle** | Same |
| All supporting pages | **Restyle** | Contact, privacy, data-source, about |

---

## Verification Plan

### Visual Check
1. `npm run dev -- -p 3000`
2. Open `http://localhost:3000` — verify command center grid
3. Check: map renders full height, nav rail works, right panel swaps, status bar displays
4. Resize to mobile — verify stacked layout, bottom tab bar, 40vh map

### Build Check
```bash
npm run build  # must pass with zero errors
```

### Regression Check
- All 30 API routes still functional (no changes to api/)
- All Tier 3 pages still navigable
- i18n still works (EN/ID toggle)
- Theme toggle still works (dark/light)
- Report flood form still submits to Supabase
- SMS subscribe still calls Twilio API
