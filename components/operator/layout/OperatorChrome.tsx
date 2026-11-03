'use client';

// Frame for the operator section (/operator/**), rendered inside the original
// app shell's content area (NavRail + StatusBar stay as they are). It mounts
// the shared replay clock once so it keeps running across the operator pages,
// keeps the SIMULASI strip and the scenario chip on screen at all times, adds
// a small sub-nav, and docks the replay controls at the bottom.

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, LayoutDashboard, Waves, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnansweredOpen } from '@/hooks/useOps';
import { PlaybackController } from '@/components/operator/ops/PlaybackController';
import { PlaybackBar } from '@/components/operator/ops/PlaybackBar';
import { ScenarioBanner } from '@/components/operator/ops/ScenarioBanner';
import { SimulasiBanner } from '@/components/operator/demo/SimulasiBadge';

interface SubNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Active on this exact path only (the section root). */
  exact?: boolean;
}

const SUB_NAV: SubNavItem[] = [
  { href: '/operator', label: 'Ringkasan', icon: LayoutDashboard, exact: true },
  { href: '/operator/polder', label: 'Polder', icon: Waves },
  { href: '/operator/rekomendasi', label: 'Rekomendasi', icon: ClipboardCheck },
];

function OperatorSubNav() {
  const pathname = usePathname() ?? '';
  const unanswered = useUnansweredOpen().length;

  return (
    <nav aria-label="Navigasi operator" className="flex min-w-0 items-center gap-0.5">
      {SUB_NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              active
                ? 'bg-op-accent/10 text-op-accent'
                : 'text-op-fg-2 hover:bg-op-surface-2 hover:text-op-fg',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sr-only sm:hidden">{item.label}</span>
            {item.href === '/operator/rekomendasi' && unanswered > 0 && (
              <span
                className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-op-border-strong bg-op-surface-3 px-1 font-mono text-[10px] font-bold tabular-nums text-op-fg"
                aria-label={`${unanswered} rekomendasi terbuka belum ditanggapi`}
              >
                {unanswered}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function OperatorChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="op-charts flex h-full min-h-0 flex-col bg-op-page font-sans text-op-fg">
      <PlaybackController />
      <SimulasiBanner active className="shrink-0" />
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-op-border bg-op-surface-1 px-2 py-1 md:px-3">
        <OperatorSubNav />
        <ScenarioBanner className="ml-auto min-w-0" />
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      <PlaybackBar className="shrink-0" />
    </div>
  );
}
