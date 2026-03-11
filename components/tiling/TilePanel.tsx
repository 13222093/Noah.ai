'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { SegmentedControl, type SegmentedTab } from './SegmentedControl';

interface TilePanelProps {
  tabs: SegmentedTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  tabVariant?: 'text' | 'icon';
  seeFullRoute?: string;
  seeFullLabel?: string;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}

export function TilePanel({
  tabs,
  activeTab,
  onTabChange,
  tabVariant = 'text',
  seeFullRoute,
  seeFullLabel,
  children,
  className,
  headerExtra,
}: TilePanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[hsl(var(--cc-surface))] overflow-hidden',
        className,
      )}
    >
      {/* Header: segmented control */}
      <div className="flex flex-col gap-1 px-2 py-1.5 border-b border-white/5 shrink-0">
        <div className="overflow-x-auto scrollbar-hide">
          <SegmentedControl
            variant={tabVariant}
            tabs={tabs}
            activeTab={activeTab}
            onChange={onTabChange}
            size="sm"
          />
        </div>
        {headerExtra && <div className="flex justify-end">{headerExtra}</div>}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {children}
      </div>

      {/* Footer: "See Full →" link */}
      {seeFullRoute && (
        <div className="shrink-0 border-t border-white/5 px-3 py-1.5">
          <Link
            href={seeFullRoute}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={12} />
            <span>{seeFullLabel || 'See Full'}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
