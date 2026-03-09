# noah.ai UI/UX Refactor Plan

The goal of this refactor is to give **noah.ai** a distinct, premium identity that visually represents the merger of *noah.ai* (real-time data monitoring) and *Jakarta-Floodnet* (AI predictive models). 

The new identity will use a **"Deep Ocean AI"** design language — combining deep, immersive dark modes with bioluminescent neon highlights to signify AI activity and critical alerts.

## 1. Design System Identity: "Deep Ocean AI"

### Color Palette Shift
Currently, the app uses standard Tailwind slate/cyan. We will evolve this to a more dramatic, high-contrast palette:
*   **Abyss Backgrounds:** Extreme dark blues (`#020617` to `#0B1120`) to reduce eye strain and make data pop.
*   **Bioluminescent Teal (Primary):** `#14b8a6` (Teal 500) to `#0d9488`. Used for safe statuses, active UI elements, and primary actions.
*   **AI Magenta/Violet (Secondary/AI):** `#8b5cf6` (Violet) or `#d946ef` (Fuchsia) to specifically highlight AI-driven predictions, differentiating ML data from raw sensor data.
*   **Alert Gradients:** Reworking warning (`amber`) and danger (`rose/red`) to use aggressive, pulsing gradients for higher physiological urgency during floods.

### Typography
*   **Primary:** Keep `Inter` for clean, readable UI text.
*   **Data/Monospace:** Introduce a monospace font (like `JetBrains Mono` or `Space Mono`, or Tailwind's default mono) for all telemetry, sensor readings, and water levels to give a "Command Center / Terminal" feel.

### Component Styling (Glassmorphism 2.0)
*   Instead of flat backgrounds, cards will use heavy background blur (`backdrop-blur-xl`) with very low opacity fills (`bg-slate-900/40`).
*   **Glow Borders:** Active components (like the region currently being monitored) will have subtle neon box-shadow glows.

---

## 2. Structural & Layout Changes

### The "Command Center" Dashboard
*   **Edge-to-Edge Map Feel:** The dashboard should feel like a floating interface over a live map or data stream, rather than boxed content.
*   **Unified AI Status Panel:** Create a dedicated, highly visible section on the dashboard that shows the *Agentic AI Status* (e.g., "LSTM Model: Active", "YOLO Vision: Scanning").
*   **Telemetry Cards:** Redesign the current weather/water level cards to look like hardware readouts (using the new monospace typography and glowing accents).

### Navigation & Sidebar
*   Streamline the sidebar. Give it a deep glass effect. 
*   Add a visual indicator in the header showing the unified "noah.ai" logo (perhaps a merging of two fluid shapes, or strong typography with a blue-to-violet gradient).

---

## 3. Implementation Steps (Phase-by-Phase)

### Phase 1: Foundation (Tokens & Globals)
*   **[MODIFY]** `tailwind.config.ts`: Inject the new "Deep Ocean" and "AI" color tokens. Add custom glow shadows (`shadow-neon-teal`, `shadow-neon-violet`).
*   **[MODIFY]** `app/globals.css`: Update the `:root` and `.dark` CSS variables to match the new abyss background and foregrounds. Enhance the `.glass` classes.
*   **[MODIFY]** `app/layout.tsx`: Inject the mono font from Google Fonts (e.g., `Space Mono`).

### Phase 2: Core Layout Updates
*   **[MODIFY]** `components/layout/Sidebar.tsx`: Apply the new visual identity, rework hover states to use bioluminescent glows.
*   **[MODIFY]** `components/layout/Header.tsx`: Update the branding to clearly say "noah.ai" with the new gradient styling.

### Phase 3: Dashboard "Command Center"
*   **[MODIFY]** `components/layout/DashboardClientPage.tsx`: Restructure the grid to feel more like a tactical heads-up display (HUD).
*   **[MODIFY]** `components/dashboard/InfrastructureStatusCard.tsx` & `MLStatusCard.tsx`: Apply the telemetry styling, monospace fonts for numbers, and specific AI-violet colors for ML statuses.

### Phase 4: Map & Alerts
*   **[MODIFY]** `components/map/FloodMap.tsx` / `PredictionLayer.tsx`: Ensure the map integration feels seamless with the dark UI. Update the prediction circles to use the new alert colors.

---

## 4. User Review Required
> [!IMPORTANT]
> Does the **"Deep Ocean AI"** with Violet/Magenta highlights for AI elements align with your vision for the merged platform? If you prefer a different aesthetic (like strict military tactical, or very clean corporate), let me know before I start updating the Tailwind configs!
