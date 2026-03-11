'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Shield, Globe } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/src/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';

/**
 * Minimal status bar for Tiling Layout.
 * - NOAH.AI branding (left)
 * - Live clock (right)
 * - Theme toggle (right)
 * - Language switcher (right)
 *
 * No stat chips, no search (search lives on the map tile).
 */
export function TilingStatusBar() {
  const { theme, setTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
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
      {/* Left: Brand */}
      <div className="flex items-center gap-2">
        <div className="tiling-brand-mark">
          <span className="tiling-brand-letter">N</span>
        </div>
        <span className="font-heading text-[13px] font-semibold text-white tracking-wider">
          NOAH.AI
        </span>
      </div>

      {/* Right: Time + Controls */}
      <div className="flex items-center gap-1.5">
        {/* Live clock */}
        <span className="font-mono text-[11px] text-slate-500 tabular-nums mr-1">
          {currentTime}
        </span>

        <div className="w-px h-3.5 bg-white/10" />

        {/* Theme toggle */}
        <button
          onClick={() => {
            const themes: Array<typeof theme> = ['light', 'dark', 'system', 'high-contrast'];
            const currentIndex = themes.indexOf(theme);
            setTheme(themes[(currentIndex + 1) % themes.length]);
          }}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded"
          title="Toggle theme"
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>

        {/* Language */}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
