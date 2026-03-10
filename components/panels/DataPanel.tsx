'use client';

import React, { useMemo } from 'react';
import {
  Droplets,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowLeft,
  Gauge,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePanel } from './PanelContext';

interface DataPanelProps {
  waterLevelPosts: any[];
  pumpStatusData: any[];
}

export function DataPanel({ waterLevelPosts, pumpStatusData }: DataPanelProps) {
  const { resetPanel } = usePanel();

  const sortedPosts = useMemo(() => {
    const order: Record<string, number> = { 'Bahaya': 0, 'Siaga': 1, 'Waspada': 2, 'Normal': 3 };
    return [...waterLevelPosts]
      .sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [waterLevelPosts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bahaya': return 'text-cc-critical bg-cc-critical/10';
      case 'Siaga': return 'text-cc-warning bg-cc-warning/10';
      case 'Waspada': return 'text-cc-caution bg-cc-caution/10';
      default: return 'text-cc-safe bg-cc-safe/10';
    }
  };

  const getTrend = (trend?: string) => {
    if (trend === 'rising') return <ArrowUp className="w-3 h-3 text-cc-critical" />;
    if (trend === 'falling') return <ArrowDown className="w-3 h-3 text-cc-safe" />;
    return <Minus className="w-3 h-3 text-cc-text-muted" />;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cc-border">
        <button onClick={resetPanel} className="text-cc-text-muted hover:text-cc-text">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Droplets className="w-4 h-4 text-cc-cyan" />
        <h2 className="text-sm font-semibold text-cc-text font-heading">Sensor Data</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Water Levels Section */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Gauge className="w-3.5 h-3.5 text-cc-cyan" />
            <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
              Water Level Posts ({sortedPosts.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {sortedPosts.slice(0, 20).map((post) => (
              <div
                key={post.id || post.name}
                className="flex items-center justify-between p-2.5 bg-cc-elevated border border-cc-border rounded"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-cc-text truncate font-medium">
                    {post.name?.split(',')[0]}
                  </p>
                  <p className="text-[10px] text-cc-text-muted truncate">
                    {post.name?.split(',').slice(1).join(',')}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className={cn(
                    'text-xs font-mono font-semibold px-1.5 py-0.5 rounded',
                    getStatusColor(post.status)
                  )}>
                    {post.level || post.waterLevel}cm
                  </span>
                  {getTrend(post.trend)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pump Status Section */}
        <div className="px-3 py-2 border-t border-cc-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-cc-cyan" />
            <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
              Pump Stations ({pumpStatusData.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {pumpStatusData.slice(0, 15).map((pump, i) => (
              <div
                key={pump.id || i}
                className="flex items-center justify-between p-2.5 bg-cc-elevated border border-cc-border rounded"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-cc-text truncate font-medium">
                    {pump.nama || pump.lokasi?.split(',')[0]}
                  </p>
                  <p className="text-[10px] text-cc-text-muted">
                    {pump.kapasitas || 'N/A'} capacity
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
                  pump.status === 'Aktif'
                    ? 'text-cc-safe bg-cc-safe/10'
                    : pump.status === 'Maintenance'
                      ? 'text-cc-caution bg-cc-caution/10'
                      : 'text-cc-critical bg-cc-critical/10'
                )}>
                  {pump.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
