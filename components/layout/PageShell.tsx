'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** If true, page fills full height (no vertical scroll padding) */
  fullHeight?: boolean;
}

/**
 * Consistent wrapper for Tier 3 pages.
 * Provides:
 * - Command center background
 * - Back-to-command-center breadcrumb
 * - Page title + optional subtitle
 * - Consistent padding & max-width
 */
export function PageShell({ title, subtitle, icon, children, fullHeight }: PageShellProps) {
  return (
    <div className={`${fullHeight ? 'h-full flex flex-col' : 'min-h-full'} bg-cc-bg text-cc-text`}>
      {/* Breadcrumb / Back nav */}
      <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center gap-3 border-b border-cc-border bg-cc-surface">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-cc-text-muted hover:text-cc-cyan transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span className="font-heading">Command Center</span>
        </Link>
        <span className="text-cc-text-muted text-xs">/</span>
        <div className="flex items-center gap-2">
          {icon && <span className="text-cc-cyan">{icon}</span>}
          <h1 className="text-sm font-semibold text-cc-text font-heading">{title}</h1>
          {subtitle && (
            <span className="text-xs text-cc-text-muted hidden sm:inline">— {subtitle}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${fullHeight ? 'flex-1 overflow-y-auto' : ''} px-4 sm:px-6 py-4`}>
        {children}
      </div>
    </div>
  );
}
