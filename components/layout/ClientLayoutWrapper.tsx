'use client';

import React, { createContext, useContext, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NavRail } from './NavRail';
import { StatusBar } from './StatusBar';
import { HtmlLangSync } from './HtmlLangSync';
import { PanelProvider } from '@/components/panels/PanelContext';
import { Toaster } from '@/components/ui/toaster';

// Keep SidebarContext for backward compatibility with MapActionsControl
interface SidebarContextType {
  isCollapsed: boolean;
  isDesktop: boolean;
}

export const SidebarContext = createContext<SidebarContextType | undefined>(
  undefined,
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

/**
 * Inner layout component that reads searchParams.
 * Wrapped in Suspense to avoid opting out of static rendering.
 */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const isTilingMode = pathname === '/dashboard' && searchParams.get('layout') !== 'classic';
  const isLandingPage = pathname === '/';
  const isContactPage = pathname === '/contact';

  // Sub-pages linked from the tiling dashboard — same clean chrome, no NavRail/StatusBar
  const tilingSubPages = [
    '/alerts', '/sensor-data', '/statistics', '/evacuation',
    '/cctv-simulation', '/current-weather', '/flood-predict',
    '/visual-verify', '/flood-report', '/sms-subscribe',
    '/settings', '/education',
  ];
  const isTilingSubPage = tilingSubPages.includes(pathname);

  // Tiling mode and its sub-pages: no NavRail/StatusBar
  if (isTilingMode || isTilingSubPage) {
    return (
      <SidebarContext.Provider value={{ isCollapsed: true, isDesktop }}>
        {children}
        <Toaster />
      </SidebarContext.Provider>
    );
  }

  // Landing and contact pages bypass the command center shell
  if (isLandingPage || isContactPage) {
    return <>{children}</>;
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed: true, isDesktop }}>
      {/* Skip to content link (accessibility) */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      <div className="cc-layout">
        {/* Nav Rail (left side on desktop, bottom tab bar on mobile) */}
        <NavRail />

        {/* Status Bar (top) */}
        <StatusBar />

        {/* Main Content */}
        <main id="main-content" className="cc-main">
          {children}
        </main>
      </div>
      <Toaster />
    </SidebarContext.Provider>
  );
}


export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelProvider>
      <HtmlLangSync />
      <Suspense fallback={null}>
        <LayoutInner>{children}</LayoutInner>
      </Suspense>
    </PanelProvider>
  );
}
