'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Droplets,
  Users,
  Brain,
  Cloud,
  Sun,
  Moon,
  Monitor,
  Shield,
  Globe,
  Search,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAlertCount } from '@/components/contexts/AlertCountContext';
import { useLanguage } from '@/src/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { CommandMenu } from './CommandMenu';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  weatherData?: {
    temp: number;
    description: string;
    icon: string;
  } | null;
  mlHealth?: {
    lstm: boolean;
    yolo: boolean;
  };
  stats?: {
    activeAlerts: number;
    floodZones: number;
    peopleAtRisk: number;
  };
}

export function StatusBar({ weatherData, mlHealth, stats }: StatusBarProps) {
  const { theme, setTheme } = useTheme();
  const { highAlertCount, loadingAlerts } = useAlertCount();
  const { t } = useLanguage();
  const [isCommandOpen, setCommandOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for command menu
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

  const themeIcons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
    'high-contrast': Shield,
  };
  const ThemeIcon = themeIcons[theme];

  const alertCount = stats?.activeAlerts ?? highAlertCount;
  const hasHighAlerts = alertCount > 0;

  return (
    <>
      <header className="cc-status-bar" role="banner">
        {/* Left: Brand + Stats */}
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-heading text-sm font-semibold text-cc-text tracking-wide hidden sm:inline">
            NOAH.AI
          </span>
          <div className="h-4 w-px bg-cc-border hidden sm:block" />

          {/* Alert count */}
          <div className={cn(
            'cc-stat-chip',
            hasHighAlerts ? 'cc-stat-chip--critical' : 'cc-stat-chip--normal'
          )}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-mono text-xs font-medium">
              {loadingAlerts ? '...' : alertCount}
            </span>
            <span className="text-xs hidden md:inline">High</span>
          </div>

          {/* Flood zones */}
          <div className="cc-stat-chip">
            <Droplets className="w-3.5 h-3.5 text-cc-cyan" />
            <span className="font-mono text-xs font-medium">{stats?.floodZones ?? 0}</span>
            <span className="text-xs hidden md:inline">Zones</span>
          </div>

          {/* People at risk */}
          <div className="cc-stat-chip">
            <Users className="w-3.5 h-3.5 text-cc-warning" />
            <span className="font-mono text-xs font-medium">
              {stats?.peopleAtRisk
                ? stats.peopleAtRisk >= 1000
                  ? `${(stats.peopleAtRisk / 1000).toFixed(1)}K`
                  : stats.peopleAtRisk
                : '0'}
            </span>
            <span className="text-xs hidden md:inline">At Risk</span>
          </div>

          {/* ML Health */}
          <div className="cc-stat-chip hidden lg:flex">
            <Brain className="w-3.5 h-3.5" />
            <span className={cn(
              'w-2 h-2 rounded-full',
              mlHealth?.lstm ? 'bg-cc-safe' : 'bg-cc-critical'
            )} />
            <span className="text-xs">LSTM</span>
            <span className={cn(
              'w-2 h-2 rounded-full ml-1',
              mlHealth?.yolo ? 'bg-cc-safe' : 'bg-cc-critical'
            )} />
            <span className="text-xs">YOLO</span>
          </div>
        </div>

        {/* Center: Search */}
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-cc-text-muted border border-cc-border rounded-md hover:border-cc-cyan/30 hover:text-cc-text-secondary transition-colors max-w-[200px]"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd className="ml-auto text-[10px] font-mono text-cc-text-muted border border-cc-border rounded px-1">⌘K</kbd>
        </button>

        {/* Right: Weather + Actions */}
        <div className="flex items-center gap-2">
          {/* Weather chip */}
          {weatherData && (
            <div className="cc-stat-chip hidden sm:flex">
              <Cloud className="w-3.5 h-3.5 text-cc-cyan" />
              <span className="font-mono text-xs">{Math.round(weatherData.temp)}°C</span>
            </div>
          )}

          {/* Time */}
          <span className="font-mono text-xs text-cc-text-muted hidden lg:inline">
            {currentTime}
          </span>

          <div className="h-4 w-px bg-cc-border" />

          {/* Theme toggle */}
          <button
            onClick={() => {
              const themes: Array<typeof theme> = ['light', 'dark', 'system'];
              const currentIndex = themes.indexOf(theme);
              setTheme(themes[(currentIndex + 1) % themes.length]);
            }}
            className="p-1.5 text-cc-text-muted hover:text-cc-text transition-colors"
            title="Toggle theme"
          >
            <ThemeIcon className="w-4 h-4" />
          </button>

          {/* Language */}
          <LanguageSwitcher />
        </div>
      </header>
      <CommandMenu isOpen={isCommandOpen} setIsOpen={setCommandOpen} />
    </>
  );
}
