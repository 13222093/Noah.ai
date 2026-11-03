'use client';

// How the flood probability for one polder changed over the replay, one line
// per lead time (by issue time). Lines are neutral (not risk colours) and
// differ by dash pattern and weight, named in the legend.

import React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LEAD_TIMES, type LeadMin, type NowcastCell } from '@/lib/ops/types';
import { formatWibDateTime, formatWibTime, getWibParts } from '@/lib/time';
import { wibHourTicks } from './timeTicks';
import { CHART, tokenColor } from '@/components/operator/ops/meta';

export const LEAD_STYLE: Record<LeadMin, { color: string; dash?: string }> = {
  60: { color: tokenColor('fg') },
  120: { color: tokenColor('fg-2'), dash: '7 4' },
  180: { color: tokenColor('fg-3'), dash: '2 3' },
};

function hhmm(t: number) {
  return formatWibTime(t).replace(' WIB', '');
}

/** "00:00" ticks carry the date so a 60-hour axis stays readable. */
function tickLabel(t: number) {
  const p = getWibParts(t);
  return p.hour === 0 ? `${p.day}/${p.month}` : hhmm(t);
}

export function ProbabilityHistoryChart({
  history,
  startMs,
  endMs,
  nowMs,
  height = 200,
}: {
  history: NowcastCell[];
  startMs: number;
  endMs: number;
  nowMs: number;
  height?: number;
}) {
  const byT = new Map<number, Record<string, number>>();
  for (const c of history) {
    const t = Date.parse(c.provenance.ts);
    if (Number.isNaN(t) || t > nowMs) continue;
    const row = byT.get(t) ?? { t };
    row[`p${c.leadMin}`] = Math.round(c.probability * 1000) / 10;
    byT.set(t, row);
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
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
        <YAxis stroke={CHART.axis} fontSize={11} width={52} unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
        <Tooltip
          contentStyle={CHART.tooltip}
          labelStyle={CHART.tooltipLabel}
          itemStyle={CHART.tooltipItem}
          labelFormatter={(t: any) => `Diterbitkan ${formatWibDateTime(Number(t))}`}
          formatter={(value: any, name: any) => [`${value}%`, `Dalam ${String(name).slice(1)} mnt`]}
        />
        <ReferenceLine
          x={nowMs}
          stroke={CHART.now}
          strokeWidth={1.5}
          label={{ value: 'sekarang', fill: CHART.now, fontSize: 10, fontWeight: 600, position: 'insideTopRight' }}
        />
        {LEAD_TIMES.map((lead) => (
          <Line
            key={lead}
            type="monotone"
            dataKey={`p${lead}`}
            stroke={LEAD_STYLE[lead].color}
            strokeDasharray={LEAD_STYLE[lead].dash}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LeadLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-op-fg-2">
      {LEAD_TIMES.map((lead) => (
        <span key={lead} className="flex items-center gap-1.5">
          <svg width="22" height="6" aria-hidden>
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              stroke={LEAD_STYLE[lead].color}
              strokeWidth="2"
              strokeDasharray={LEAD_STYLE[lead].dash}
            />
          </svg>
          dalam {lead} mnt
        </span>
      ))}
    </div>
  );
}
