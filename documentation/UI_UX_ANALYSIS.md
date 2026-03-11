# Floodzie UI/UX Analysis

## Tech Stack

- Next.js 16 (App Router) + React 18
- Tailwind CSS 3.3 + tailwindcss-animate
- shadcn/ui (Radix primitives + CVA)
- Framer Motion for animations
- Leaflet + react-leaflet for maps
- Zustand for global state
- React Query for server state
- next-themes pattern (custom useTheme hook)
- i18n via custom LanguageContext (Indonesian + English)
- PWA support via @ducanh2912/next-pwa

## Layout Architecture

The app uses a shell pattern managed by `ClientLayoutWrapper.tsx`:

- **Landing page** (`/`) and **Contact page** (`/contact`) bypass the shell — render children directly with no sidebar or header.
- All other pages get the full shell: fixed left **Sidebar** + sticky top **Header** + scrollable `<main>` content area.
- The **flood-map page** gets special treatment with `flex-1 overflow-auto h-full w-full` (fullscreen map), while other pages get `flex-1 p-4`.
- A **SplashScreen** displays for 6 seconds on first session load (stored in `sessionStorage`), featuring animated "Floodzie" branding with a loading progress bar.

### Component Organization

```
components/
  ui/           -- shadcn/ui primitives (Button, Card, Badge, Dialog, Tabs, etc.)
  layout/       -- Shell components (Header, Sidebar, Footer, ClientLayoutWrapper, SplashScreen)
  dashboard/    -- Dashboard-specific widgets (WeatherSummaryCard, AirQualityCard, MLStatusCard, etc.)
  flood-map/    -- Map page components (PetaBanjirClient, MapSearchControl, MapActionsControl, etc.)
  flood/        -- Flood alert cards (FloodAlert, PeringatanBencanaCard)
  map/          -- Shared map components (FloodMap, MapControls, WeatherInsightMap, etc.)
  weather/      -- Weather display components
  sensor-data/  -- Sensor visualization components
  modals/       -- Modal components (LocationPickerModal)
  contexts/     -- React contexts (AlertCountContext)
  providers/    -- Provider wrappers (ReactQueryProvider)
```

## Navigation & User Flows

### Primary Navigation (Sidebar) — 12 Items

1. Dashboard (`/`) — Home
2. Flood Monitoring (`/flood-map`) — Interactive Leaflet map
3. Weather Forecast (`/weather-forecast`)
4. Alerts (`/alerts`) — Real-time alert monitoring with AI analysis
5. Report Flood (`/flood-report`) — Community flood reporting
6. Flood Predict (`/flood-predict`) — ML-based predictions
7. Visual Verify (`/visual-verify`) — Image-based verification
8. CCTV Simulation (`/cctv-simulation`)
9. Evacuation Info (`/evacuation`) — Routes + shelters
10. Sensor Data (`/sensor-data`) — Infrastructure monitoring
11. Statistics (`/statistics`)
12. About (`/about.html?mode=read`) — Static HTML page

### Header Actions (Right Side)

- Search (opens CommandMenu via Cmd+K) — uses cmdk library
- Theme toggle (light/dark/system cycle)
- Language switcher (ID/EN)
- Notification bell (links to `/alerts`, shows badge count)
- Settings gear (links to `/settings`)

### Dashboard Flow

The dashboard (`/dashboard/page.tsx`) is a server component that fetches BMKG earthquake data + generates mock water level/pump/alert data, then passes it to `DashboardClientPage`. The client page renders:

1. Hero section with background image + stats cards
2. Region selector dropdown (cascading Province > Regency > District > Village)
3. Interactive flood map (desktop: inline card; mobile: opens in a Drawer)
4. Weather + Air Quality + ML Status sidebar cards (contextual to selected location)
5. Infrastructure status (water level posts + pump status)
6. Real-time disaster alerts carousel
7. Floating AI chatbot (sends messages to `/api/chatbot` backed by Gemini)

### Map Page Flow (`/flood-map`)

Full-screen map with:
- Search control overlay at top center
- Filter/action controls
- Flood report markers with severity indicators
- Evacuation routing (geolocation to nearest shelter)
- Prediction risk layer toggle
- Bottom carousel of flood report cards (collapsible on mobile)

## Visual Design Language

### Colors

- **Primary:** Slate-based dark palette (`#0F172A` base) — maps to the `ocean-700` tone
- **Secondary/Accent:** Cyan (`#06B6D4`) and Blue (`#3B82F6`) — the "ocean" theme
- **Semantic:** Warning (amber `#F59E0B`), Danger (red `#EF4444`), Success (green `#10B981`)
- **CSS Variables:** HSL-based variables for shadcn/ui theming (`--background`, `--foreground`, `--card`, etc.)
- **Dark mode:** Deep navy (`224 71.4% 4.1%` = approximately `#020817`) with muted borders
- **Gradients:** `ocean-gradient` (dark navy to cyan), `glass-gradient` (subtle white transparency), gradient text (cyan to blue)

### Typography

- **Font:** Inter (loaded via `next/font/google` and also via Google Fonts CSS import — duplicated loading)
- **Body:** `font-family: 'Inter', sans-serif` with `line-height: 1.6`
- **Headings:** `line-height: 1.2`
- **Splash screen:** Large display text at `text-6xl sm:text-7xl lg:text-8xl font-bold`

### Visual Effects

- Glassmorphism utility classes (`.glass`, `.glass-dark`) with backdrop blur
- Glow shadows (`shadow-glow`, `shadow-glow-lg`) using cyan
- Card hover: `hover:-translate-y-0.5 hover:shadow-lg` (lift effect)
- Radial gradient aura on card hover
- Shimmer loading effect
- Floating animation (`float 3s ease-in-out infinite`)
- Pulse ring animation for status indicators

## Responsive Design

### Breakpoint Strategy

- Mobile-first with `useMediaQuery('(max-width: 768px)')` as the primary breakpoint
- Large screen detection: `useMediaQuery('(min-width: 1024px)')`
- Tailwind responsive prefixes: `sm:`, `md:`, `lg:` used throughout

### Mobile Adaptations

- **Sidebar:** Slides in as overlay with backdrop blur on mobile (280px width), hidden by default. Hamburger menu triggers it.
- **Header:** Mobile gets a search icon that expands to full-width search mode. Logo text hidden on `< sm`.
- **Dashboard map:** On mobile, inline map is replaced with a CTA card that opens a full-screen `Drawer` (vaul).
- **Hero section:** Different background images for mobile vs desktop (`banjirmobile.png` / `banjir.png`).
- **Carousel navigation:** Previous/Next buttons hidden on mobile (`hidden sm:flex`).
- **Grid layouts:** Collapse from multi-column to single-column: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- **Footer:** 4-column grid on desktop, single column stacked on mobile.
- **Flood map:** Bottom carousel with toggle handle (collapsible) — good mobile pattern.

## Key Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout with provider hierarchy |
| `app/globals.css` | CSS variables, glassmorphism utilities, leaflet overrides |
| `tailwind.config.ts` | Full design token system (ocean theme, animations, shadows) |
| `components/layout/ClientLayoutWrapper.tsx` | Shell architecture with sidebar/header orchestration |
| `components/layout/Header.tsx` | Sticky header with search, theme, language, notifications |
| `components/layout/Sidebar.tsx` | 12-item navigation with collapse, search, quick actions |
| `components/layout/DashboardClientPage.tsx` | Main dashboard with map, weather, alerts, chatbot |
| `app/flood-map/page.tsx` | Full-screen map page with carousel, filters, routing |
| `app/alerts/page.tsx` | Alert monitoring with tabs, AI analysis, news |
| `components/ui/card.tsx` | Customized Card with CVA variants + motion |
| `components/ui/badge.tsx` | Extended Badge with semantic variants |
| `components/ui/Button.tsx` | shadcn button + glass variant |
| `hooks/useTheme.tsx` | Theme provider with light/dark/system/high-contrast |
| `lib/store.ts` | Zustand store for selected location + map bounds |
| `src/context/LanguageContext.tsx` | i18n context |
| `src/i18n/id.ts` / `src/i18n/en.ts` | Translation dictionaries |
