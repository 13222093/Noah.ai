'use client';

// Water level at one post against its Siaga 3/2/1 lines, with hourly rain
// over the polder as bars. The x axis spans the whole scenario window but data
// stops at the replay time (no peeking ahead); a vertical line marks "now".

import React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LevelPoint, RainPoint, Station } from '@/lib/ops/types';
import { formatWibDateTime, formatWibTime, getWibParts } from '@/lib/time';
import { wibHourTicks } from './timeTicks';
import { CHART, QUALITY_LABEL, SIAGA_LINE, SIAGA_META } from '@/components/operator/ops/meta';

interface Row {
  t: number;
  cm?: number | null;
  flagged?: number | null;
  quality?: string;
  siaga?: string;
  rain?: number;
}

function hhmm(t: number) {
  return formatWibTime(t).replace(' WIB', '');
}

/** "00:00" ticks carry the date so a 60-hour axis stays readable. */
function tickLabel(t: number) {
  const p = getWibParts(t);
  return p.hour === 0 ? `${p.day}/${p.month}` : hhmm(t);
}

export function PostLevelChart({
  station,
  levels,
  rain,
  startMs,
  endMs,
  nowMs,
  height = 280,
}: {
  station: Station;
  levels: LevelPoint[];
  rain: RainPoint[];
  startMs: number;
  endMs: number;
  nowMs: number;
  height?: number;
}) {
  // Levels and rain have different timestamps, so each series keeps its own
  // data (a merged table would break the level line at every rain row).
  const rows: Row[] = levels
    .map((p) => ({
      t: Date.parse(p.ts),
      cm: p.cm,
      flagged: p.quality !== 'ok' ? p.cm : null,
      quality: p.quality,
      siaga: p.siaga,
    }))
    .filter((r) => !Number.isNaN(r.t))
    .sort((a, b) => a.t - b.t);
  // Hourly rain as steps: value from the start of the hour to its end.
  const rainRows: Array<{ t: number; rain: number }> = rain
    .map((r) => ({ t: Date.parse(r.ts), rain: r.mm }))
    .filter((r) => !Number.isNaN(r.t))
    .sort((a, b) => a.t - b.t);
  if (rainRows.length > 0) {
    const last = rainRows[rainRows.length - 1];
    rainRows.push({ t: last.t + 3_600_000, rain: last.rain });
  }
  const hasFlagged = rows.some((r) => r.flagged != null);
  const th = station.thresholds;
  const lines: Array<{ key: 'siaga3' | 'siaga2' | 'siaga1'; value: number | null }> = [
    { key: 'siaga3', value: th.siaga3 },
    { key: 'siaga2', value: th.siaga2 },
    { key: 'siaga1', value: th.siaga1 },
  ];
  const maxRain = Math.max(10, ...rain.map((r) => r.mm));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[startMs, endMs]}
          ticks={wibHourTicks(startMs, endMs)}
          tickFormatter={tickLabel}
          stroke={CHART.axis}
          fontSize={11}
          allowDataOverflow
        />
        <YAxis yAxisId="level" stroke={CHART.axis} fontSize={11} width={52} unit=" cm" domain={['auto', 'auto']} />
        <YAxis
          yAxisId="rain"
          orientation="right"
          stroke={CHART.axis}
          fontSize={11}
          width={44}
          unit=" mm"
          domain={[0, Math.ceil(maxRain * 2.2)]}
        />
        <Tooltip
          cursor={{ stroke: CHART.cursor, strokeDasharray: '3 3' }}
          contentStyle={CHART.tooltip}
          labelStyle={CHART.tooltipLabel}
          itemStyle={CHART.tooltipItem}
          labelFormatter={(t: any) => formatWibDateTime(Number(t))}
          formatter={(value: any, name: any, item: any) => {
            if (name === 'rain') return [`${value} mm/jam`, 'Hujan'];
            if (name === 'flagged') return [`${value} cm`, 'Pembacaan diragukan'];
            const row = item?.payload as Row | undefined;
            const siaga = row?.siaga ? ` · ${SIAGA_META[row.siaga as keyof typeof SIAGA_META]?.label ?? row.siaga}` : '';
            const q = row?.quality && row.quality !== 'ok' ? ` · ${QUALITY_LABEL[row.quality as keyof typeof QUALITY_LABEL]}` : '';
            return [`${value} cm${siaga}${q}`, 'Tinggi muka air'];
          }}
        />
        <Area
          yAxisId="rain"
          data={rainRows}
          dataKey="rain"
          type="stepAfter"
          stroke={CHART.rain}
          strokeOpacity={0.6}
          fill={CHART.rain}
          fillOpacity={0.35}
          isAnimationActive={false}
          activeDot={false}
        />
        {lines.map(
          (l) =>
            l.value !== null && (
              <ReferenceLine
                key={l.key}
                yAxisId="level"
                y={l.value}
                stroke={SIAGA_LINE[l.key]}
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
                label={{
                  value: `${SIAGA_META[l.key].label} · ${l.value}`,
                  fill: SIAGA_LINE[l.key],
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
            ),
        )}
        <ReferenceLine
          yAxisId="level"
          x={nowMs}
          stroke={CHART.now}
          strokeWidth={1.5}
          label={{ value: 'sekarang', fill: CHART.now, fontSize: 10, fontWeight: 600, position: 'insideTopRight' }}
        />
        <Line
          yAxisId="level"
          type="monotone"
          dataKey="cm"
          stroke={CHART.level}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {hasFlagged && (
          <Line
            yAxisId="level"
            type="monotone"
            dataKey="flagged"
            stroke={CHART.flagged}
            strokeWidth={3}
            strokeDasharray="2 3"
            dot={{ r: 2, fill: CHART.flagged }}
            connectNulls={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
