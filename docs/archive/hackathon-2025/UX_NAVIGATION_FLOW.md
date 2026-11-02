# UX Navigation Flow Map

**Date**: March 11, 2026
**Purpose**: Document all navigation paths, button destinations, and page transitions in noah.ai.

---

## All Routes (18 pages)

| Route | Page Component | Description |
|---|---|---|
| `/` | Landing page | Public landing page (bypasses command center shell) |
| `/contact` | Contact page | Contact form (bypasses command center shell) |
| `/dashboard` | `CommandCenterView` | **Main command center** — map + sidebar + alert feed + chatbot |
| `/alerts` | Alert list | Full alert list page |
| `/sensor-data` | `DataSensorPage` | Sensor data charts + statistics dashboard + flood reports table |
| `/current-weather` | Weather page | Current weather display |
| `/weather-forecast` | Forecast page | Weather forecast |
| `/flood-predict` | LSTM Prediction | AI flood prediction form |
| `/visual-verify` | YOLO Verification | Upload images for flood detection |
| `/cctv-simulation` | CCTV Monitor | Live camera feeds with detection overlay |
| `/flood-map` | Flood map | Dedicated flood map view |
| `/flood-report` | Flood report | Submit flood reports |
| `/evacuation` | Evacuation | Evacuation routes |
| `/data-source` | Data sources | Data source documentation |
| `/statistics` | Statistics | Statistical dashboard |
| `/education` | Education | Flood education content |
| `/sms-subscribe` | SMS Subscribe | SMS alert subscription |
| `/settings` | Settings | App settings |
| `/privacy` | Privacy | Privacy policy |

---

## NavRail (Left Sidebar / Bottom Tab Bar)

### Primary Items (always visible)

```
┌──────────────┬──────────┬──────────────────┬─────────────────────────────────┐
│   Nav Item   │   Icon   │    Current href   │         Current Behavior        │
├──────────────┼──────────┼──────────────────┼─────────────────────────────────┤
│ Command      │ Layout   │ /dashboard       │ Navigate to dashboard           │
│ Alerts       │ Triangle │ /alerts          │ Navigate to alerts page         │
│ Data         │ Database │ /sensor-data     │ Navigate to sensor data page    │
│ Weather      │ CloudSun │ /current-weather │ Navigate to weather page        │
│ AI Tools     │ Brain    │ (none)           │ Swap sidebar to AIToolsPanel    │
│ More         │ ···      │ (overflow)       │ Opens overflow menu             │
└──────────────┴──────────┴──────────────────┴─────────────────────────────────┘
```

### Overflow Items (under "More" button)

```
┌──────────────┬────────────────┐
│   Item       │   Route        │
├──────────────┼────────────────┤
│ Statistics   │ /statistics    │
│ Education    │ /education     │
│ SMS Alert    │ /sms-subscribe │
│ Settings     │ /settings      │
│ About        │ /about.html    │
│ Privacy      │ /privacy       │
└──────────────┴────────────────┘
```

---

## handleNavClick Logic (NavRail.tsx:79-111)

```
User clicks nav item
  │
  ├─ Is on /dashboard AND item has panelId AND item has NO href?
  │   └─ YES → swap sidebar panel (AI Tools only)
  │   └─ NO  → continue ↓
  │
  ├─ Item has href?
  │   └─ YES → navigate to that href
  │   └─ NO  → continue ↓
  │
  ├─ Item is 'command'?
  │   └─ YES → navigate to /dashboard
  │   └─ NO  → continue ↓
  │
  └─ Item has panelId?
      └─ YES → navigate to /dashboard + set pendingPanel
      └─ NO  → do nothing
```

**Key**: Items WITH `href` always navigate. Items WITHOUT `href` (currently only AI Tools) swap the sidebar panel when on dashboard, or navigate to dashboard + set panel when off dashboard.

---

## Sidebar Panels (PanelSwitcher — desktop /dashboard only)

The right sidebar (280px) on `/dashboard` shows different panels:

| Panel ID | Component | Shown via |
|---|---|---|
| `alerts` | `AlertPanel` | Default, or sidebar swap |
| `data` | `DataPanel` | Sidebar swap only (AI Tools) |
| `weather` | `WeatherPanel` | Sidebar swap only (AI Tools) |
| `ai-tools` | `AIToolsPanel` | AI Tools nav click |

### AIToolsPanel Internal Links

```
┌──────────────────────────┬────────────────────┐
│        Tool              │    Navigates to    │
├──────────────────────────┼────────────────────┤
│ LSTM Flood Prediction    │ /flood-predict     │
│ Visual Verification      │ /visual-verify     │
│ CCTV Monitoring          │ /cctv-simulation   │
└──────────────────────────┴────────────────────┘
```

---

## SidebarSummary (always visible above panels)

Shows compact weather + top water level + ML health — always visible regardless of active panel.

---

## isActive Highlighting Logic (NavRail.tsx:113-118)

| Nav Item | Active when... |
|---|---|
| Command | `pathname === '/dashboard'` (but only when NOT on dashboard with panel open) |
| Alerts | `pathname === '/alerts'` OR (on dashboard AND `activePanel === 'alerts'`) |
| Data | `pathname === '/sensor-data'` OR `pathname === '/evacuation'` OR (on dashboard AND `activePanel === 'data'`) |
| Weather | (on dashboard AND `activePanel === 'weather'`) |
| AI Tools | `pathname === '/flood-predict'` OR `/visual-verify` OR `/cctv-simulation` OR (on dashboard AND `activePanel === 'ai-tools'`) |

---

## Pages That Bypass Command Center Shell

These pages render WITHOUT the NavRail, StatusBar, or sidebar:

- `/` (landing page)
- `/contact`

All other pages render INSIDE `ClientLayoutWrapper` → NavRail + StatusBar + main content.
