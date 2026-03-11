'use client';

import React from 'react';
import { Thermometer, Droplets, BrainCircuit, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarSummaryProps {
  weatherData: { temperature?: number; condition?: string; icon?: string } | null;
  topWaterPost: { name: string; level: number; status: string; trend?: string } | null;
  mlHealth: { lstmReady: boolean; visionReady: boolean } | null;
}

/**
 * Compact always-visible summary at top of sidebar.
 * Shows weather + highest water level + ML health without panel switching.
 */
export function SidebarSummary({ weatherData, topWaterPost, mlHealth }: SidebarSummaryProps) {
  const getTrendIcon = (trend?: string) => {
    if (trend === 'Naik' || trend === 'up') return <ArrowUp className="w-3 h-3 text-cc-critical" />;
    if (trend === 'Turun' || trend === 'down') return <ArrowDown className="w-3 h-3 text-cc-safe" />;
    return <Minus className="w-3 h-3 text-cc-text-muted" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bahaya': return 'text-cc-critical';
      case 'Siaga': return 'text-cc-warning';
      case 'Waspada': return 'text-cc-caution';
      default: return 'text-cc-safe';
    }
  };

  return (
    <div className="px-3 py-2 border-b border-cc-border bg-cc-surface">
      <div className="grid grid-cols-2 gap-2">
        {/* Weather */}
        <div className="flex items-center gap-1.5 min-w-0">
          {weatherData?.icon ? (
            <img
              src={`https://openweathermap.org/img/wn/${weatherData.icon}.png`}
              alt=""
              className="w-6 h-6 opacity-80"
            />
          ) : (
            <Thermometer className="w-3.5 h-3.5 text-cc-warning flex-shrink-0" />
          )}
          <div className="min-w-0">
            {weatherData?.temperature != null ? (
              <>
                <p className="text-xs font-mono font-semibold text-cc-text leading-none">
                  {Math.round(weatherData.temperature)}°C
                </p>
                <p className="text-[9px] text-cc-text-muted truncate leading-none mt-0.5">
                  {weatherData.condition || 'No data'}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-cc-text-muted">No weather</p>
            )}
          </div>
        </div>

        {/* Top Water Level */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Droplets className="w-3.5 h-3.5 text-cc-cyan flex-shrink-0" />
          <div className="min-w-0">
            {topWaterPost ? (
              <>
                <div className="flex items-center gap-1">
                  <span className={cn('text-xs font-mono font-semibold leading-none', getStatusColor(topWaterPost.status))}>
                    {topWaterPost.level}cm
                  </span>
                  {getTrendIcon(topWaterPost.trend)}
                </div>
                <p className="text-[9px] text-cc-text-muted truncate leading-none mt-0.5">
                  {topWaterPost.name?.split(',')[0]}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-cc-text-muted">No sensors</p>
            )}
          </div>
        </div>
      </div>

      {/* ML Health Row */}
      {mlHealth && (
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-cc-border/50">
          <BrainCircuit className="w-3 h-3 text-cc-cyan flex-shrink-0" />
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="flex items-center gap-1">
              <span className={cn('w-1.5 h-1.5 rounded-full', mlHealth.lstmReady ? 'bg-cc-safe' : 'bg-cc-warning')} />
              LSTM
            </span>
            <span className="flex items-center gap-1">
              <span className={cn('w-1.5 h-1.5 rounded-full', mlHealth.visionReady ? 'bg-cc-safe' : 'bg-cc-warning')} />
              Vision
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
