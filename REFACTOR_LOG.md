# Command Center Refactor — Detailed Log

> Refactored Noah.ai from a sidebar-based dashboard into a command center UI with persistent map, nav rail, panel switching, and tiered feature access.

---

## Design Philosophy

The old layout used a **collapsible sidebar** for navigation and a **header bar** for actions. The new design adopts a **command center** paradigm:

- **Map is always visible** — it's the central element, never hidden behind navigation
- **Tiered feature access** — critical info is always-on (Tier 1), secondary info is one-click panels (Tier 2), full tools are separate pages (Tier 3)
- **Panel switching** — the right sidebar swaps content based on nav rail clicks, no page navigation needed for common operations
- **Consistent visual identity** — deep navy background, electric cyan accents, Space Grotesk + JetBrains Mono fonts

---

## Tier System

### Tier 1 — Always Visible
| Feature | Location |
|---|---|
| Flood Map | Center of screen, full height |
| Alert Feed | Right sidebar (default panel) |
| Water Levels Strip | Bottom of map, horizontal scroll |
| Status Bar | Top bar — alert count, flood zones, people at risk, time, weather |
| AI Chatbot | Floating button, bottom-right |
| Evacuation Markers | On the map |

### Tier 2 — One-Click Panels (swap right sidebar)
| Feature | Trigger |
|---|---|
| Data Panel (Water Levels + Pumps) | Click "Data" in nav rail |
| AI Tools Panel (ML health + links) | Click "AI Tools" in nav rail |
| Alert Feed | Click "Alerts" or "Command" in nav rail |

### Tier 3 — Full Pages (with back-to-CC breadcrumb)
| Feature | Route |
|---|---|
| LSTM Flood Prediction | `/flood-predict` |
| Visual Verification (YOLO) | `/visual-verify` |
| CCTV Monitoring | `/cctv-simulation` |
| Statistics & Analytics | `/statistics` |
| Education Hub | `/education` |
| Settings | `/settings` |

---

## Phase 1: Layout Shell

**Goal:** Replace sidebar + header with nav rail + status bar + command center grid.

### Files Created
- **`components/layout/NavRail.tsx`** — 5-item vertical nav rail (Command, Alerts, Data, AI Tools, More) with overflow menu, alert badge, loading states, and panel-aware navigation
- **`components/layout/StatusBar.tsx`** — Top bar showing: active alert count, flood zone count, people at risk, ML model health indicators, current time, weather chip, theme toggle, language switcher, search trigger

### Files Modified
- **`app/globals.css`** — Complete rewrite:
  - Added CSS custom properties (`--cc-bg`, `--cc-surface`, `--cc-cyan`, etc.) for the command center color system
  - Created `.cc-layout` grid: `64px (nav rail) | 1fr (main)` columns, `40px (status bar) | 1fr (content)` rows
  - Added `.cc-nav-rail`, `.cc-nav-item`, `.cc-nav-item--active`, `.cc-nav-label`, `.cc-nav-logo` classes
  - Added `.cc-status-bar`, `.cc-status-chip` classes
  - Mobile layout: bottom tab-bar instead of left rail
  - Accessibility: `.skip-to-content` link, `focus-visible` ring, `prefers-reduced-motion` media query
  - Removed global `transition: all` antipattern

- **`tailwind.config.ts`** — Added:
  - `fontFamily.heading` → Space Grotesk
  - `fontFamily.mono` → JetBrains Mono
  - `colors.cc-*` (bg, surface, elevated, cyan, text, border, critical, warning, caution, safe)
  - `borderRadius.DEFAULT` → 6px

- **`components/layout/ClientLayoutWrapper.tsx`** — Complete rewrite:
  - Removed `Sidebar`, `Header`, `SplashScreen` imports
  - New structure: `PanelProvider > SidebarContext > .cc-layout > NavRail + StatusBar + main`
  - Landing/contact pages bypass the shell
  - Kept `SidebarContext` export for backward compatibility with `MapActionsControl`

- **`app/layout.tsx`** — Updated:
  - Replaced Inter font with Space Grotesk (headings) + JetBrains Mono (data/mono)
  - Set `html lang="en"` (dynamically settable)
  - Toaster styled with `cc-*` tokens
  - Removed splash screen dependency

---

## Phase 2: Command Center Dashboard

**Goal:** Build the main dashboard view with persistent map, alert feed, water levels, and AI chatbot.

### Files Created
- **`components/layout/CommandCenterView.tsx`** (418 lines) — Three embedded panel components:
  - **`AlertPanel`** — Right sidebar showing severity-sorted alerts with color-coded badges (Tinggi=red, Sedang=orange, Rendah=green), population impact, and quick actions (Report Flood, SMS Subscribe)
  - **`WaterLevelsStrip`** — Compact horizontal strip below the map showing 8 most critical water level posts with status dot, name, value in cm, and trend arrow (↑ rising, ↓ falling, — stable)
  - **`AIChatbot`** — Floating button that expands to a 320×384px chat window, connects to `/api/chatbot`, displays conversation history with role-based styling
  - **Desktop layout:** `flex` — map fills available space, 280px right sidebar, water levels strip below map
  - **Mobile layout:** stacked — 40vh map, water levels strip, scrollable alert feed, floating chatbot

### Files Modified
- **`app/dashboard/page.tsx`** — Simplified:
  - Removed `Footer` import (command center is full-height)
  - Replaced `DashboardClientPage` with `CommandCenterView`
  - Server-side data fetching unchanged (BMKG quake, water levels, pump status, alerts)

---

## Phase 3: Panel System (Tier 2)

**Goal:** Enable the right sidebar to swap between different panels based on nav rail selection without page navigation.

### Files Created
- **`components/panels/PanelContext.tsx`** — React context + provider:
  - `PanelId` type: `'alerts' | 'data' | 'weather' | 'alert-detail' | 'evacuation' | 'cctv' | 'ai-tools'`
  - `activePanel` state (default: `'alerts'`)
  - `panelData` for passing detail data (e.g. specific alert ID)
  - `setPanel(panel, data?)` and `resetPanel()` actions

- **`components/panels/DataPanel.tsx`** — Water levels + pump status panel:
  - Water level posts sorted by severity (Bahaya → Siaga → Waspada → Normal)
  - Each post shows: name, location, value in cm with status badge, trend arrow
  - Pump stations with name, capacity, and operational status (Aktif/Maintenance/Offline)
  - Back arrow returns to alert feed

- **`components/panels/AIToolsPanel.tsx`** — ML tools panel:
  - Model health section: LSTM Predictor and YOLO Detector with online/offline indicators
  - 3 tool cards linking to full pages: LSTM Flood Prediction, Visual Verification (YOLO), CCTV Monitoring
  - Each card has icon, title, description, and arrow link

- **`components/panels/PanelSwitcher.tsx`** — Orchestrator component:
  - Reads `activePanel` from `PanelContext`
  - Renders the correct panel: `DataPanel`, `AIToolsPanel`, or `AlertPanel` (default)
  - Receives all data props and passes them to the appropriate panel

### Files Modified
- **`components/layout/NavRail.tsx`** — Updated navigation logic:
  - When on dashboard (`/dashboard` or `/`): clicking Alerts/Data/AI Tools calls `setPanel()` → swaps right panel
  - When on other pages: navigates to dashboard and sets the panel
  - `isActive()` now checks `activePanel` state when on dashboard
  - Removed `href` from nav items that use panel switching

- **`components/layout/ClientLayoutWrapper.tsx`** — Added `PanelProvider` wrapping the entire layout

- **`components/layout/CommandCenterView.tsx`** — Right sidebar now renders `<PanelSwitcher>` instead of hardcoded `<AlertPanel>`

---

## Phase 4: Restyle Tier 3 Pages

**Goal:** Give every full-page feature a consistent command center look with a back-to-CC breadcrumb.

### Files Created
- **`components/layout/PageShell.tsx`** — Reusable wrapper:
  - Back-to-CC breadcrumb: `← 🏠 Command Center / [icon] Page Title — subtitle`
  - Sets `bg-cc-bg text-cc-text` background
  - Two modes: `fullHeight` (flex, no scroll padding) or default (min-h-full with padding)
  - Breadcrumb uses `cc-border` bottom border, cyan hover on back link

### Files Modified (wrapped with PageShell)
| Page | Icon | Additional Changes |
|---|---|---|
| `flood-predict/page.tsx` | BrainCircuit | Removed h1 header, kept all LSTM logic |
| `visual-verify/page.tsx` | Camera | Removed h1 header, kept drag-drop + YOLO logic |
| `cctv-simulation/page.tsx` | Video | Removed h1 header, kept 4-channel grid |
| `settings/page.tsx` | Settings | Removed gradient hero banner, kept all preference logic |
| `statistics/page.tsx` | BarChart3 | Updated filter panel to cc-* tokens, kept AnimatePresence tabs |
| `education/page.tsx` | GraduationCap | Full restyle: card backgrounds → `bg-cc-surface`, borders → `cc-border`, text → `cc-text`, hover → `cc-cyan` |

---

## Design Tokens Reference

```css
/* Backgrounds */
--cc-bg:        #0a0e1a    /* Deep navy */
--cc-surface:   #111827    /* Panel backgrounds */
--cc-elevated:  #1e293b    /* Card/input backgrounds */

/* Accent */
--cc-cyan:      #22d3ee    /* Electric cyan — primary action */

/* Text */
--cc-text:           #f1f5f9
--cc-text-secondary: #94a3b8
--cc-text-muted:     #64748b

/* Borders */
--cc-border:        #1e293b
--cc-border-active: #334155

/* Semantic */
--cc-critical: #ff3d00  /* Red — danger/critical alerts */
--cc-warning:  #ff9100  /* Orange — warnings */
--cc-caution:  #ffd600  /* Yellow — caution/waspada */
--cc-safe:     #00e676  /* Green — normal/safe */
```

## Fonts
- **Space Grotesk** — Headings, UI labels, navigation (`.font-heading`)
- **JetBrains Mono** — Data values, timestamps, status badges (`.font-mono`)

---

## Build Verification

All 4 phases were verified with `npx next build`:

| Phase | Result |
|---|---|
| Phase 1: Layout Shell | ✅ Exit code 0 |
| Phase 2: Command Center Dashboard | ✅ Exit code 0 |
| Phase 3: Panel System | ✅ Exit code 0 |
| Phase 4: Restyle Tier 3 Pages | ✅ Exit code 0 |

All routes compile successfully — no type errors, no JSX issues, no missing imports.
