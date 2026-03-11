'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SegmentedTab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps {
  variant?: 'text' | 'icon';
  tabs: SegmentedTab[];
  activeTab: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl({
  variant = 'text',
  tabs,
  activeTab,
  onChange,
  size = 'sm',
  className,
}: SegmentedControlProps) {
  const isIcon = variant === 'icon';
  const h = size === 'sm' ? 'h-8' : 'h-9';
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-black/30 p-0.5',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={isIcon ? tab.label : undefined}
            className={cn(
              'relative flex items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all duration-150',
              h,
              isIcon && 'px-2',
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5',
            )}
          >
            {Icon && (
              <Icon
                size={iconSize}
                className={cn(
                  'shrink-0',
                  isActive ? 'text-white' : 'text-slate-400',
                )}
              />
            )}
            {!isIcon && (
              <span className="truncate">{tab.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
