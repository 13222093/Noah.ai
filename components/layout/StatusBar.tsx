'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Shield, Search } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { formatWibTime } from '@/lib/time';
import { CommandMenu } from './CommandMenu';

/**
 * Top bar for sub-pages. The old stat chips (alerts, zones, people at risk,
 * LSTM/YOLO status) showed mock numbers and were removed (B-019). The
 * connector health strip (UI-048) takes their place in W2.
 */
export function StatusBar() {
  const { theme, setTheme } = useTheme();
  const [isCommandOpen, setCommandOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => setCurrentTime(formatWibTime(Date.now(), { seconds: true }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const themeIcons = { light: Sun, dark: Moon, system: Monitor, 'high-contrast': Shield };
  const ThemeIcon = themeIcons[theme];

  return (
    <>
      <header className="cc-status-bar" role="banner">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-heading text-sm font-semibold text-cc-text tracking-wide">Noah AI</span>
        </div>

        <button
          onClick={() => setCommandOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-cc-text-muted border border-cc-border rounded-md hover:border-cc-cyan/30 hover:text-cc-text-secondary transition-colors max-w-[200px]"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Cari...</span>
          <kbd className="ml-auto text-[10px] font-mono text-cc-text-muted border border-cc-border rounded px-1">Ctrl K</kbd>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-cc-text-muted hidden lg:inline" title="Waktu sekarang (WIB)">
            {currentTime}
          </span>
          <div className="h-4 w-px bg-cc-border" />
          <button
            onClick={() => {
              const themes: Array<typeof theme> = ['light', 'dark', 'system', 'high-contrast'];
              setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);
            }}
            className="p-1.5 text-cc-text-muted hover:text-cc-text transition-colors"
            title="Ganti tema"
            aria-label="Ganti tema"
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
          <LanguageSwitcher />
        </div>
      </header>
      <CommandMenu isOpen={isCommandOpen} setIsOpen={setCommandOpen} />
    </>
  );
}
