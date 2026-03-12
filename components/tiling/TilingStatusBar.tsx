'use client';

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Shield, CloudRain, Wind, Layers, MapPin } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/src/context/LanguageContext';
import { useMapLayerStore } from '@/lib/mapLayerStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { RegionSelector } from './RegionSelector';
import { cn } from '@/lib/utils';

/**
 * Minimal status bar for Tiling Layout.
 * - NOAH.AI branding (left)
 * - Map layer toggles (center)
 * - Live clock + Theme toggle + Language switcher (right)
 */
export function TilingStatusBar() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState('');
  const {
    showRadar, showAqi, showFloodZones, showEvacPins,
    toggleRadar, toggleAqi, toggleFloodZones, toggleEvacPins,
  } = useMapLayerStore();

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

  const mapButtons = [
    { id: 'radar', label: t('mapLayers.radar'), icon: CloudRain, active: showRadar, toggle: toggleRadar, activeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { id: 'aqi', label: t('mapLayers.aqi'), icon: Wind, active: showAqi, toggle: toggleAqi, activeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { id: 'floods', label: t('mapLayers.floodZones'), icon: Layers, active: showFloodZones, toggle: toggleFloodZones, activeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { id: 'evac', label: t('mapLayers.evacPins'), icon: MapPin, active: showEvacPins, toggle: toggleEvacPins, activeColor: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ];

  return (
    <header className="tiling-status-bar">
      {/* Left: Brand */}
      <div className="flex items-center gap-2.5">
        <div className="tiling-brand-mark">
          <span className="tiling-brand-letter">N</span>
        </div>
        <span className="font-heading text-[13px] font-bold tracking-wide bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 bg-clip-text text-transparent">
          Noah AI
        </span>
        <div className="w-px h-3.5 bg-white/10" />
        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Center: Map Layer Toggles */}
      <div className="flex items-center gap-1">
        {mapButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={btn.toggle}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border',
              btn.active
                ? btn.activeColor
                : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-white/5'
            )}
            title={btn.label}
          >
            <btn.icon size={10} />
            <span className="hidden sm:inline">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Center-Right: Region Selector */}
      <div className="hidden md:flex items-center gap-1">
        <div className="w-px h-3.5 bg-white/10" />
        <RegionSelector />
      </div>

      {/* Right: Time + Controls */}
      <div className="flex items-center gap-1.5">
        {/* Live clock */}
        <span className="font-mono text-[11px] text-slate-400 tabular-nums mr-1">
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
          className="p-1 text-slate-400 hover:text-white transition-colors rounded"
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
