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
import { Sparkline } from '@/components/ui/Sparkline';

interface DataPanelProps {
  waterLevelPosts: any[];
  pumpStatusData: any[];
  timeAgo?: string;
}

export function DataPanel({ waterLevelPosts, pumpStatusData, timeAgo }: DataPanelProps) {
  const { resetPanel } = usePanel();

  const sortedPosts = useMemo(() => {
    const order: Record<string, number> = { 'Bahaya': 0, 'Siaga': 1, 'Waspada': 2, 'Normal': 3 };
    return [...waterLevelPosts]
      .sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [waterLevelPosts]);

  // Pre-compute sparkline data so Math.random() doesn't jitter on re-render
  const sparklineData = useMemo(() => {
    const map = new Map<string, number[]>();
    waterLevelPosts.forEach((post) => {
      const key = post.id || post.name;
      const level = post.level || post.waterLevel || 100;
      const isRising = post.trend === 'Naik' || post.trend === 'up';
      const isFalling = post.trend === 'Turun' || post.trend === 'down';
      const delta = isRising ? -5 : isFalling ? 5 : 0;
      map.set(key, Array.from({ length: 6 }, (_, i) => level + delta * (5 - i) + (Math.random() * 3 - 1.5)));
    });
    return map;
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
        {timeAgo && <span className="ml-auto text-[10px] text-cc-text-muted font-mono">Updated {timeAgo}</span>}
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
                  <Sparkline data={sparklineData.get(post.id || post.name) || []} />
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

        {/* Infrastructure Status Section */}
        <div className="px-3 py-2 border-t border-cc-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-cc-warning" />
            <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
              Infrastructure Status (Placeholder)
            </span>
          </div>
          <div className="space-y-1.5">
            {[
              { name: 'Road Access', status: 'Operational', statusColor: 'text-cc-safe bg-cc-safe/10' },
              { name: 'Bridge Integrity', status: 'Monitoring', statusColor: 'text-cc-caution bg-cc-caution/10' },
              { name: 'Communication', status: 'Active', statusColor: 'text-cc-safe bg-cc-safe/10' },
              { name: 'Power Grid', status: 'Partial', statusColor: 'text-cc-warning bg-cc-warning/10' },
            ].map((infra) => (
              <div
                key={infra.name}
                className="flex items-center justify-between p-2.5 bg-cc-elevated border border-cc-border rounded"
              >
                <p className="text-xs text-cc-text font-medium">{infra.name}</p>
                <span className={cn(
                  'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
                  infra.statusColor
                )}>
                  {infra.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
