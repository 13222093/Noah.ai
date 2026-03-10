'use client';

import React, { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NavRail } from './NavRail';
import { StatusBar } from './StatusBar';
import { PanelProvider } from '@/components/panels/PanelContext';

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

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isLandingPage = pathname === '/';
  const isContactPage = pathname === '/contact';

  // Landing and contact pages bypass the command center shell
  if (isLandingPage || isContactPage) {
    return <>{children}</>;
  }

  return (
    <PanelProvider>
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
      </SidebarContext.Provider>
    </PanelProvider>
  );
}
