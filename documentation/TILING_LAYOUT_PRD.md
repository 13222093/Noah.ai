# PRD: Hyprland-Inspired Tiling Command Center

**Version**: 1.1 (revised)
**Date**: March 11, 2026
**Author**: Antigravity AI + Ari Azis
**Status**: Ready for Implementation

---

## 1. Overview

### Problem
The current noah.ai dashboard uses a narrow 60px NavRail on the left with a single swappable right sidebar. This creates several issues:
- Features are hidden behind icon-only navigation
- Only one panel visible at a time (alerts OR data OR AI tools)
- Bottom ticker is a thin scrolling marquee with no interaction
- Layout doesn't communicate "command center" authority
- Wasted screen real estate

### Vision
Redesign the dashboard layout as a **tiling window manager** inspired by Hyprland/i3 on Arch Linux. The screen is divided into edge-to-edge tiles, each serving a distinct purpose. Every tile has a **segmented control** to switch between data views. The map is always the **master tile** (largest area).

### Design Principles
1. **Every pixel earns its place** — no decorative chrome, all functional
2. **Separation of concerns** — actions (left), awareness (right), context (bottom)
3. **Glanceable** — operator sees critical data without clicking
4. **Progressive disclosure** — summary in tile, "See Full →" for dedicated page
5. **Hyprland aesthetic** — 2px dark gap borders, no rounded corners on tile edges, sharp grid

---

## 2. Layout Architecture

### Desktop (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  StatusBar (48px fixed)                                               │
│  NOAH.AI | 8 High | 72 Zones | 189 Regions | LSTM● YOLO● | 🔍 | 🕐 │
├───────────┬──────────────────────────────────┬───────────────────────┤
│           │                                  │                       │
│ LEFT TILE │         MASTER TILE              │  RIGHT TILE           │
│ ~200px    │         (Map)                    │  ~280px               │
│ fixed     │         flex-1                   │  fixed                │
│           │                                  │                       │
│ Icons:    │                                  │  Segmented Control:   │
│ [🤖][🗺][📋]│                                │  [Alerts|Sensor|      │
│ [💬][⚙️]  │                                  │   Weather|AQI]        │
│           │                                  │                       │
│ Panel     │                                  │  Panel content        │
│ content   │                                  │  (scrollable)         │
│           │                                  │                       │
│           │                                  │  ┌──────────────────┐ │
│           │                                  │  │ [See Full → ]    │ │
│ ┌───────┐ │                                  │  └──────────────────┘ │
│ │Chat ▸ │ │                                  │                       │
│ └───────┘ │                                  │                       │
├───────────┼───────────────────── drag ───────┴───────────────────────┤
│  BOTTOM TILE (~180px default, drag-expandable to ~400px)             │
│  Segmented: [Water Levels | Pump Status | Earthquake]                │
│  ┌─────────────────────────────┬─────────────────────────────────┐   │
│  │ Pos         Tinggi  Status  │ Nama Pompa    Lokasi    Status  │   │
│  │ Pintu Air   1.56m  Siaga 3  │ Pompa Ancol   Jakarta   Aktif  │   │
│  └─────────────────────────────┴─────────────────────────────────┘   │
│                                              [See Full → /sensor-data]│
└──────────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Range | Layout |
|---|---|
| **≥1280px** | Full layout: left 200px + map flex-1 + right 280px + bottom |
| **1024–1279px** | Compressed: left **collapses to 64px icon-only** + map flex-1 + right **240px** + bottom |
| **768–1023px** | Tablet: left hidden, map fullscreen, right as slide-over sheet, bottom as bottom sheet |
| **<768px** | Mobile: map fullscreen + bottom sheet with tabs |

### Mobile (<768px)

```
┌────────────────────────┐
│ StatusBar (compact)     │
├────────────────────────┤
│                         │
│   MAP (fullscreen)      │
│                         │
├────────────────────────┤
│ Bottom Sheet (swipe-up) │
│ [Intel|Commands|        │
│  Data|Chat]             │
│                         │
│ Panel content here      │
└────────────────────────┘
```

**Mobile tab mapping:**
- **Intel** = Right tile content (Alerts, Sensor, Weather, AQI sub-tabs)
- **Commands** = Left tile content (AI Tools, Reports, SMS, Settings) + Map Layer toggles
- **Data** = Bottom tile content (Water Levels, Pump Status, Earthquake)
- **Chat** = Chatbot (full-height)

---

## 3. Tile Specifications

### 3.1 Left Tile — "Command Hub"

**Purpose**: Non-urgent actions and features. The operator's toolbox.
**Width**: 200px (≥1280px), 64px icon-only (1024–1279px)
**Always expanded**: Yes (at respective widths)

#### Segmented Control — Icon-Only Mode

At 200px, 5 text tabs don't fit. Solution: **icon row with tooltips**.

```
┌──────────────────────┐
│  [🤖] [🗺] [📋] [💬] [⚙]  │  ← icon buttons, 36px each
│  ─────────────────── │     active = blue bg pill
│                      │
│  Panel content       │
│                      │
└──────────────────────┘
```

| Icon | Tooltip | Tab ID | Content | "See Full" Route |
|---|---|---|---|---|
| 🤖 `Brain` | AI Tools | `ai-tools` | LSTM predict, YOLO verify, model health dots | `/flood-predict` |
| 🗺 `Map` | Map Layers | `map-layers` | Layer toggles + **Location Picker** button | — |
| 📋 `ClipboardList` | Reports | `reports` | Quick flood report form | `/flood-report` |
| 💬 `MessageSquare` | SMS | `sms` | SMS subscription status | `/sms-subscribe` |
| ⚙ `Settings` | Settings | `settings` | Language, theme, notifications | `/settings` |

At **1024–1279px** (64px collapsed): show only the icon column, no panel content. On click, the panel slides out as a 200px overlay over the map.

#### Chatbot (Bottom of Left Tile)
- **Fixed position** at bottom of left tile (not overlapping panel content)
- **Collapsed**: Single-line input bar "Ask noah..." (48px height)
- **Expanded**: Chatbot takes a fixed bottom portion (~200px). The panel content above scrolls independently. Chat does NOT overlay panels — it **pushes the panel scroll area smaller**.
- Chatbot button in collapsed state opens the expanded view

### 3.2 Right Tile — "Intel Feed"

**Purpose**: Urgent notifications and real-time awareness data.
**Width**: 280px (≥1280px), 240px (1024–1279px)
**Always expanded**: Yes

#### Segmented Control Tabs

| Tab | Content | "See Full" Route |
|---|---|---|
| **Alerts** | Alert feed: severity badges, timestamps, situation summary card | `/alerts` |
| **Sensor** | **Top 10 by severity** with sparklines and status badges. Summary view. | `/sensor-data` |
| **Weather** | Current weather card (temp, humidity, wind), mini forecast, rain probability | `/current-weather` |
| **AQI** | Air quality gauge, PM2.5 level, health recommendation | — |

> **Sensor vs Bottom Water Levels (deduplication):**
> - Right tile **Sensor tab** = Top N stations sorted by severity. Sparkline visualization. Glanceable overview.
> - Bottom tile **Water Levels tab** = Full sortable/searchable table of ALL water level posts. Operational detail view.
> - The right tile answers "what's critical?" The bottom tile answers "show me everything."

#### Design
- Each tab shows a scrollable list/card view
- Top of panel: data freshness timestamp ("Updated 2m ago")
- Bottom of panel: "See Full →" link to dedicated page

### 3.3 Bottom Tile — "Context Bar"

**Purpose**: Supplementary data tables — not urgent but operationally useful.
**Height**: ~180px default
**Expandable**: Drag handle upward to ~400px max
**Collapsible**: Drag handle down to ~40px (just segmented control row visible)

#### Segmented Control Tabs

| Tab | Content | "See Full" Route |
|---|---|---|
| **Water Levels** | Full table: ALL posts — Pos, Tinggi, Status, Pembaruan. Sortable + searchable. | `/sensor-data` |
| **Pump Status** | Full table: ALL pumps — Nama, Lokasi, Status (Aktif/Maintenance/Rusak). Searchable. | `/sensor-data` |
| **Earthquake** | Latest BMKG earthquake data: magnitude, location, depth, distance, shake map | — |

#### Design
- Two-column table layout (water levels left, pump status right) when width allows
- Search/filter bar at top of each table
- Rows colored by severity (red/yellow/green)
- Compact rows (~36px height) to fit more data

### 3.4 Master Tile — Map

**Purpose**: Primary visualization. The operator's main view.
**Size**: flex-1 (fills all remaining space)
**Always the largest tile**

#### Content
- Leaflet FloodMap with all existing layers
- Map controls (zoom, fullscreen) in top-left corner
- Floating search bar centered at top
- **Location Picker**: Triggered from Left tile "Map Layers" tab OR a floating pin button on the map

---

## 4. Segmented Control Component

### Specification
The UI pattern from the user's reference (Radar/AQI toggle):
- **Pill-shaped container** with dark background (`bg-cc-surface`)
- **Active tab**: Filled with accent color (brand blue `#3B82F6`), white text
- **Inactive tabs**: Text only, `text-muted-foreground`, subtle hover brightening
- **Icons**: Optional leading icon per tab
- **Compact**: ~32px height, fits in tight tile headers
- **Variants**: `text` (right/bottom tiles with labels), `icon` (left tile with icons only)

### Component API
```tsx
<SegmentedControl
  variant="text" | "icon"
  tabs={[
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'sensor', label: 'Sensor', icon: Activity },
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
  size="sm" | "md"
/>
```

---

## 5. Tile Borders & Gaps

### Hyprland Aesthetic
- **Gap width**: 2px between all tiles
- **Gap color**: `rgba(0, 0, 0, 0.6)` — dark void between tiles
- **No rounded corners** on tile edges that touch other tiles
- **Subtle inner radius** (4px) only on corners that face the screen edge
- **Border accent**: 1px `rgba(56, 189, 248, 0.1)` for subtle tile delineation

### Draggable Divider
- Horizontal divider between map+right and bottom tile
- Visual: 4px grabbable zone with a centered 2px line
- Hover state: line brightens to `hsl(var(--cc-accent))`
- Cursor: `row-resize` on hover
- Drag behavior: min 40px (collapsed), max 400px, default 180px
- Stores user preference in `localStorage` key `noah-bottom-tile-height`

---

## 6. Data Flow

### State Management
Each tile manages its own active tab. Persisted to `localStorage`:
```
noah-left-tab:     'ai-tools' | 'map-layers' | 'reports' | 'sms' | 'settings'
noah-right-tab:    'alerts' | 'sensor' | 'weather' | 'aqi'
noah-bottom-tab:   'water-levels' | 'pump-status' | 'earthquake'
noah-bottom-height: number (px)
```

### Data Sources

| Source | Provider | Note |
|---|---|---|
| Alerts | `initialData.realTimeAlerts` | From `dashboard/page.tsx` server component |
| Water Levels | `initialData.waterLevelPosts` | Mock data via `generateMockWaterLevels()` |
| Pump Status | `initialData.pumpStatusData` | Mock data via `generateMockPumpStatus()` |
| Weather | `useWeatherData()` hook | Client-side fetch |
| AQI | `useAirPollutionData()` hook | Client-side fetch |
| Earthquake | `useBmkgQuakeData()` hook | Client-side fetch |
| ML Health | `initialData.stats.mlHealth` | ✅ Fixed in this session — `dashboard/page.tsx` now includes HEAD checks |

### Location Picker
- **Primary trigger**: Button in Left tile "Map Layers" tab labeled "📍 Set Location"
- **Secondary trigger**: Floating pin icon on master map tile (top-left, below map controls)
- **Behavior unchanged**: Opens `LocationPickerModal`, sets weather/chatbot/disaster context

---

## 7. Component Architecture

### New Components

| Component | Purpose |
|---|---|
| `TilingLayout.tsx` | CSS Grid root layout — 3 columns × 2 rows |
| `SegmentedControl.tsx` | Reusable pill-tab switcher (text + icon variants) |
| `LeftTile.tsx` | Command Hub wrapper with icon tabs |
| `RightTile.tsx` | Intel Feed wrapper with text tabs |
| `BottomTile.tsx` | Context Bar wrapper with drag-resize |
| `DragDivider.tsx` | Horizontal drag handle component |
| `TilePanel.tsx` | Generic tile container (header + scrollable content + "See Full" footer) |
| `MobileSheet.tsx` | Bottom sheet for mobile with 4-tab navigation |

### Panels to Refactor (existing → tile-compatible)

| Existing | Becomes |
|---|---|
| `AIToolsPanel.tsx` | Left tile "AI Tools" tab |
| `DataPanel.tsx` | Right tile "Sensor" tab (top N compact) |
| `WeatherPanel.tsx` | Right tile "Weather" tab |
| `SidebarSummary.tsx` | Merged into Right tile header |
| `AirQualityCard.tsx` | Right tile "AQI" tab |
| `InfrastructureStatusCard.tsx` | Bottom tile "Water Levels" + "Pump Status" |
| `PeringatanBencanaCard.tsx` | Right tile "Alerts" tab cards |
| `AIChatbot` | Left tile bottom chatbot section |

### Components to Remove/Replace

| Component | Reason |
|---|---|
| `NavRail.tsx` | Replaced by Left Tile |
| `PanelSwitcher.tsx` | Replaced by per-tile tab routing |
| `SidebarSummary.tsx` | Absorbed into Right Tile |
| Bottom `WaterLevelTicker` | Replaced by Bottom Tile tables |

---

## 8. Rollback Strategy

This is a full layout shell replacement. To avoid a broken app during development:

### Feature Flag
- URL parameter `?layout=tiling` enables the new layout
- Default layout remains `CommandCenterView` until tiling is verified
- Implementation in `ClientLayoutWrapper.tsx`:
```tsx
const searchParams = useSearchParams();
const useTiling = searchParams.get('layout') === 'tiling';
// Render TilingLayout or CommandCenterView based on flag
```
- Once verified, flip the default and remove the flag

### Preserved Files
- `CommandCenterView.tsx` — kept intact, not modified
- `NavRail.tsx` — kept intact, not modified
- `PanelSwitcher.tsx` — kept intact, not modified

All new tiling code goes in `components/tiling/` directory. Zero changes to existing components until the tiling layout is validated.

---

## 9. Implementation Phases (Revised Estimates)

### Phase 1: Foundation (~4-5 hours)
- Build `SegmentedControl.tsx` (icon + text variants)
- Build `TilingLayout.tsx` (CSS Grid)
- Build `DragDivider.tsx` with localStorage persistence
- Build `TilePanel.tsx` (generic wrapper)
- Feature flag in `ClientLayoutWrapper.tsx`
- Responsive breakpoint handling (≥1280, 1024–1279, <1024)

### Phase 2: Tile Content (~3-4 hours)
- Build `LeftTile.tsx` with 5 icon tabs + chatbot section
- Build `RightTile.tsx` with 4 text tabs
- Build `BottomTile.tsx` with 3 text tabs + data tables
- Refactor existing panels to fit tile dimensions
- Wire up all data sources

### Phase 3: Polish (~2-3 hours)
- Hyprland gap styling fine-tuning
- Mobile bottom sheet (`MobileSheet.tsx`)
- "See Full →" routing for all panels
- `localStorage` persistence for all tab states
- Keyboard shortcuts (optional)
- Regression testing on all existing pages

**Total: ~10 hours**

---

## 10. Success Criteria

- [ ] All 3 tiles render with segmented controls
- [ ] Map is always the master (takes most space at every breakpoint)
- [ ] Each tab shows real data from existing hooks/APIs
- [ ] Bottom tile is drag-expandable (40px → 400px)
- [ ] "See Full →" links navigate to correct pages
- [ ] 2px Hyprland-style gaps between all tiles
- [ ] Left tile collapses to 64px icons at 1024–1279px
- [ ] Right tile narrows to 240px at 1024–1279px
- [ ] Mobile: map fullscreen + bottom sheet with 4 tabs
- [ ] Feature flag works: `?layout=tiling`
- [ ] `tsc --noEmit` → zero errors
- [ ] No regressions on existing pages (`/sensor-data`, `/alerts`, etc.)
- [ ] Old layout still accessible (rollback)
