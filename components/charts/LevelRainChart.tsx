'use client';

// Level and rain chart (recharts), refactored from the old SensorSimulatorChart.
// The old version polled a CSV replay every 3 s; this one is prop-driven only.
// - Time axis in WIB (lib/time).
// - Thresholds come from station config (D12), never hardcoded here.
// - Shows the source and "data terakhir"; greys out when stale.
// Intended for Polder detail (W2).

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { formatDataTerakhir, formatWibDateTime, formatWibTime, isStale, parseUtc } from '@/lib/time';

export interface LevelRainPoint {
  /** UTC ISO timestamp of the observation. */
  ts: string;
  /** Water level in cm relative to the station datum. */
  level_cm?: number | null;
  /** Rainfall in mm for the interval ending at ts. */
  rain_mm?: number | null;
}

export interface ChartThreshold {
  value_cm: number;
  label: string;
  color: string;
}

export function LevelRainChart({
  data,
  source,
  thresholds = [],
  staleAfterMinutes,
  height = 260,
  className,
}: {
  data: LevelRainPoint[];
  /** e.g. "Pos Manggarai (DSDA)". Required: every number needs a source. */
  source: string;
  thresholds?: ChartThreshold[];
  staleAfterMinutes?: number;
  height?: number;
  className?: string;
}) {
  // Wall clock for the staleness check, read outside render (react-hooks/purity)
  // and refreshed every minute so the chart greys out once data goes stale.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(interval);
    };
  }, []);

  if (data.length === 0) {
    return <EmptyState description={`Belum ada pengamatan dari ${source}.`} className={className} />;
  }

  const rows = data.map((d) => ({ ...d, t: parseUtc(d.ts).getTime() }));
  const latest = data[data.length - 1].ts;
  const stale = now !== null && isStale(latest, now, staleAfterMinutes);
  const hasRain = data.some((d) => d.rain_mm != null);

  return (
    <div className={cn('space-y-2', stale && 'opacity-50 grayscale', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(t: number) => formatWibTime(t).replace(' WIB', '')}
            stroke="#64748b"
            fontSize={11}
          />
          <YAxis yAxisId="level" stroke="#64748b" fontSize={11} unit=" cm" />
          {hasRain && <YAxis yAxisId="rain" orientation="right" stroke="#64748b" fontSize={11} unit=" mm" />}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelFormatter={(t: number) => formatWibDateTime(t)}
            formatter={(value: number, name: string) =>
              name === 'level_cm' ? [`${value} cm`, 'Tinggi muka air'] : [`${value} mm`, 'Curah hujan']
            }
          />
          {thresholds.map((th) => (
            <ReferenceLine
              key={th.label}
              yAxisId="level"
              y={th.value_cm}
              stroke={th.color}
              strokeDasharray="3 3"
              label={{ value: th.label, fill: th.color, fontSize: 10, position: 'insideTopLeft' }}
            />
          ))}
          <Line yAxisId="level" type="monotone" dataKey="level_cm" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls={false} />
          {hasRain && (
            <Line yAxisId="rain" type="monotone" dataKey="rain_mm" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-cc-text-muted">
        Sumber: {source} · {formatDataTerakhir(latest)}
        {stale && ' · data sudah lama'}
      </p>
    </div>
  );
}
