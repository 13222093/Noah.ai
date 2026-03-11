'use client';

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDashboardData } from './DashboardDataContext';
import { DragDivider } from './DragDivider';
import { LeftTile } from './LeftTile';
import { RightTile } from './RightTile';
import { BottomTile } from './BottomTile';
import { MobileSheet } from './MobileSheet';
import { FloodMap } from '@/components/map/FloodMap';
import { TilingStatusBar } from './TilingStatusBar';
import { Brain } from 'lucide-react';
import './tiling.css';

export function TilingLayout() {
  const data = useDashboardData();
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isCompressed = useMediaQuery(
    '(min-width: 1024px) and (max-width: 1279px)',
  );

  const [bottomHeight, setBottomHeight] = useLocalStorage(
    'noah-bottom-tile-height',
    180,
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);

  // Sort sensors by severity for mobile
  const topSensors = useMemo(() => {
    const severity: Record<string, number> = { Bahaya: 0, 'Siaga 3': 1, 'Siaga 2': 2, 'Siaga 1': 3, Normal: 4 };
    return [...(data.waterLevelPosts || [])]
      .sort((a, b) => (severity[a.status] ?? 5) - (severity[b.status] ?? 5))
      .slice(0, 8);
  }, [data.waterLevelPosts]);

  const renderMobileContent = useCallback((tab: string) => {
    switch (tab) {
      case 'alerts':
        return (
          <div className="p-3 space-y-2">
            <p className="text-xs text-red-400 font-semibold">
              ⚡ {data.realTimeAlerts?.length || 0} active alerts
            </p>
            {(data.realTimeAlerts || []).slice(0, 10).map((alert: any, i: number) => (
              <div key={alert.id || i} className="rounded-md bg-white/[0.03] border border-white/5 p-2 space-y-0.5">
                <p className="text-xs text-slate-300 line-clamp-1">{alert.title || alert.description}</p>
                <p className="text-[10px] text-slate-500">📍 {alert.location || 'Unknown'}</p>
              </div>
            ))}
          </div>
        );
      case 'sensor':
        return (
          <div className="p-3 space-y-1">
            <p className="text-[10px] text-slate-500 mb-1">Top sensors by severity</p>
            {topSensors.map((post: any, i: number) => (
              <div key={post.id || i} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02]">
                <p className="text-xs text-slate-300 truncate flex-1">{post.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  post.status === 'Bahaya' ? 'bg-red-500/20 text-red-400' :
                  post.status?.includes('Siaga') ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>{post.status}</span>
              </div>
            ))}
          </div>
        );
      case 'weather':
        return (
          <div className="p-3 text-center">
            <p className="text-3xl font-light text-slate-200">--°C</p>
            <p className="text-xs text-slate-500 mt-1">Select a location on map</p>
          </div>
        );
      case 'ai':
        return (
          <div className="p-3 space-y-2">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600/20 text-blue-400 text-xs font-medium">
              <Brain size={14} /> LSTM Predict
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600/20 text-emerald-400 text-xs font-medium">
              <span>👁</span> YOLO Verify
            </button>
            <div className="flex gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />LSTM Ready</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Vision Ready</span>
            </div>
          </div>
        );
      case 'water':
        return (
          <div className="p-3 space-y-1">
            <p className="text-[10px] text-slate-500 mb-1">Water Levels</p>
            {(data.waterLevelPosts || []).slice(0, 6).map((post: any, i: number) => (
              <div key={post.id || i} className="flex items-center justify-between px-2 py-1 text-xs">
                <span className="text-slate-300 truncate flex-1">{post.name}</span>
                <span className="text-slate-500">{post.tinggi} m</span>
                <span className={`ml-2 text-[10px] ${
                  post.status === 'Normal' ? 'text-emerald-400' : 'text-yellow-400'
                }`}>{post.status}</span>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  }, [data, topSensors]);

  return (
    <>
      <TilingStatusBar />
      <div ref={containerRef} className="tiling-root">
      {/* Left Tile — Command Hub */}
      <div className="tiling-left tiling-tile">
        <LeftTile collapsed={isCompressed} />
      </div>

      {/* Master Tile — Map */}
      <div className="tiling-master tiling-tile">
        <FloodMap
          isFullscreen={isFullscreen}
          onFullscreenToggle={toggleFullscreen}
          className="w-full h-full"
        />
      </div>

      {/* Right Tile — Intel Feed */}
      <div className="tiling-right tiling-tile">
        <RightTile />
      </div>

      {/* Bottom Area: drag divider + bottom tile */}
      <div
        className="tiling-bottom-area"
        style={{ height: bottomHeight }}
      >
        <DragDivider
          onResize={setBottomHeight}
          containerRef={containerRef}
          minHeight={40}
          maxHeight={400}
        />
        <div className="tiling-tile flex-1 overflow-hidden">
          <BottomTile />
        </div>
      </div>
    </div>

    {/* Mobile bottom sheet — visible only on <768px */}
    {isMobile && (
      <MobileSheet>
        {renderMobileContent}
      </MobileSheet>
    )}
    </>
  );
}

