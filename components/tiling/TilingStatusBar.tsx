'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Shield } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { formatWibTime } from '@/lib/time';

/**
 * Top bar of the operator frame: brand, current WIB clock, theme and language.
 * It shows no data status: the connector health strip (UI-048) lands in W2
 * once /api/v1/health reports per-connector freshness.
 */
export function TilingStatusBar() {
  const { theme, setTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => setCurrentTime(formatWibTime(Date.now(), { seconds: true }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
    'high-contrast': Shield,
  };
  const ThemeIcon = themeIcons[theme];

  return (
    <header className="tiling-status-bar">
      <div className="flex items-center gap-2.5">
        <div className="tiling-brand-mark">
          <span className="tiling-brand-letter">N</span>
        </div>
        <span className="font-heading text-[13px] font-bold tracking-wide bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 bg-clip-text text-transparent">
          Noah AI
        </span>
        <div className="w-px h-3.5 bg-white/10" />
        <span className="hidden sm:inline text-[11px] text-slate-400">Pendukung Keputusan Pengendalian Banjir</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-slate-400 tabular-nums mr-1" title="Waktu sekarang (WIB)">
          {currentTime}
        </span>
        <div className="w-px h-3.5 bg-white/10" />
        <button
          onClick={() => {
            const themes: Array<typeof theme> = ['light', 'dark', 'system', 'high-contrast'];
            setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
          }}
          className="p-1 text-slate-400 hover:text-white transition-colors rounded"
          title="Ganti tema"
          aria-label="Ganti tema"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
