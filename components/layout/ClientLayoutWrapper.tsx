'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { NavRail } from './NavRail';
import { StatusBar } from './StatusBar';
import { HtmlLangSync } from './HtmlLangSync';
import { Toaster } from '@/components/ui/toaster';

// Routes that render their own full-screen operator frame (TilingLayout).
const FRAME_ROUTES = new Set(['/']);

/**
 * App chrome. Access control lives in middleware.ts (backend); role-based
 * navigation is added with OIDC in W3 (UI-041).
 */
export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (FRAME_ROUTES.has(pathname)) {
    return (
      <>
        <HtmlLangSync />
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <>
      <HtmlLangSync />
      <a href="#main-content" className="skip-to-content">
        Langsung ke konten
      </a>
      <div className="cc-layout">
        <NavRail />
        <StatusBar />
        <main id="main-content" className="cc-main">
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}
