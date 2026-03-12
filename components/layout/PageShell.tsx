'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** If true, page fills full height (no vertical scroll padding) */
  fullHeight?: boolean;
}

/**
 * Consistent wrapper for sub-pages.
 * Provides:
 * - Command center background
 * - Compact back link
 * - Page title + optional subtitle
 * - Consistent padding
 */
export function PageShell({ title, subtitle, icon, children, fullHeight }: PageShellProps) {
  return (
    <div className={`${fullHeight ? 'h-full flex flex-col' : 'min-h-full'} bg-cc-bg text-cc-text`}>
      {/* Compact page header */}
      <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link
          href="/dashboard?layout=tiling"
          className="flex items-center gap-1 text-[11px] text-cc-text-muted hover:text-cc-cyan transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-heading">Kembali</span>
        </Link>
        <span className="text-cc-border text-xs">|</span>
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-cc-cyan shrink-0">{icon}</span>}
          <h1 className="text-sm font-bold text-cc-text font-heading truncate">{title}</h1>
          {subtitle && (
            <span className="text-[11px] text-cc-text-muted hidden sm:inline truncate">— {subtitle}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`${fullHeight ? 'flex-1 overflow-y-auto' : ''} px-4 sm:px-6 py-3`}>
        {children}
      </div>
    </div>
  );
}
