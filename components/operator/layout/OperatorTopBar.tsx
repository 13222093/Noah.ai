'use client';

// Top bar of the operator section: the tiling dashboard's TilingStatusBar look
// (same 32px bar, brand mark, chip, pills, mono clock, theme and language
// buttons; classes from components/tiling/tiling.css) with operator content:
// a way back to /dashboard, the REPLAY chip in place of LIVE, the section tabs
// and the replay clock in place of the wall clock.

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, LayoutDashboard, Monitor, Moon, Shield, Sun, Waves, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useUnansweredOpen } from '@/hooks/useOps';
import { usePlaybackStore } from '@/lib/ops/playback';
import { formatWibTime } from '@/lib/time';
import { ScenarioBanner } from '@/components/operator/ops/ScenarioBanner';
import '@/components/tiling/tiling.css';

interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Active on this exact path only (the section root). */
  exact?: boolean;
}

const TABS: TabItem[] = [
  { href: '/operator', label: 'Ringkasan', icon: LayoutDashboard, exact: true },
  { href: '/operator/polder', label: 'Polder', icon: Waves },
  { href: '/operator/rekomendasi', label: 'Rekomendasi', icon: ClipboardCheck },
];

/** Section tabs in the dashboard's SegmentedControl style, sized for the 32px bar. */
function OperatorTabs() {
  const pathname = usePathname() ?? '';
  const unanswered = useUnansweredOpen().length;

  return (
    <nav aria-label="Navigasi operator" className="inline-flex items-center gap-0.5 rounded-lg bg-black/30 p-0.5">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-6 items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-all duration-150',
              active ? 'bg-op-accent-fill text-op-on-accent shadow-sm' : 'text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
            )}
          >
            <Icon size={12} className={cn('shrink-0', active ? 'text-op-on-accent' : 'text-op-fg-2')} aria-hidden />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sr-only sm:hidden">{tab.label}</span>
            {tab.href === '/operator/rekomendasi' && unanswered > 0 && (
              <span
                className={cn(
                  'inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold tabular-nums',
                  active ? 'bg-white/20 text-op-on-accent' : 'bg-white/10 text-op-fg',
                )}
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

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor, 'high-contrast': Shield } as const;

export function OperatorTopBar() {
  const { theme, setTheme } = useTheme();
  const nowMs = usePlaybackStore((s) => s.nowMs);
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header className="tiling-status-bar shrink-0 gap-2">
      {/* Left: back, brand, REPLAY chip */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-op-fg-2 transition-all hover:bg-white/5 hover:text-white"
          title="Kembali ke dashboard"
        >
          <ArrowLeft size={10} aria-hidden />
          <span className="hidden sm:inline">Dashboard</span>
          <span className="sr-only sm:hidden">Dashboard</span>
        </Link>
        <div className="h-3.5 w-px shrink-0 bg-white/10" />
        <div className="tiling-brand-mark shrink-0">
          <span className="tiling-brand-letter">N</span>
        </div>
        <span className="hidden shrink-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 bg-clip-text font-heading text-[13px] font-bold tracking-wide text-transparent sm:inline">
          Noah AI
        </span>
        <div className="h-3.5 w-px shrink-0 bg-white/10" />
        <ScenarioBanner className="-ml-1.5" />
      </div>

      {/* Center: section tabs */}
      <OperatorTabs />

      {/* Right: replay clock + controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        {nowMs !== null && (
          <span className="mr-1 hidden font-mono text-[11px] tabular-nums text-op-fg-2 md:inline" title="Jam replay (WIB), bukan jam sekarang">
            replay {formatWibTime(nowMs)}
          </span>
        )}

        <div className="hidden h-3.5 w-px bg-white/10 md:block" />

        <button
          type="button"
          onClick={() => {
            const themes: Array<typeof theme> = ['light', 'dark', 'system', 'high-contrast'];
            const currentIndex = themes.indexOf(theme);
            setTheme(themes[(currentIndex + 1) % themes.length]);
          }}
          className="rounded p-1 text-op-fg-2 transition-colors hover:text-white"
          title="Toggle theme"
          aria-label="Ganti tema"
        >
          <ThemeIcon className="h-3.5 w-3.5" />
        </button>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
