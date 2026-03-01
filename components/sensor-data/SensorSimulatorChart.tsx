'use client';

import React, { useState, useEffect } from 'react';
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
import { format } from 'date-fns';
import { Droplets, CloudRain } from 'lucide-react';

interface SimDataPoint {
  timestamp: string;
  water_level_cm: number;
  rainfall_mm: number;
  risk_level: string;
  time: string;
}

export function SensorSimulatorChart() {
  const [data, setData] = useState<SimDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndAppend = async () => {
      try {
        const res = await fetch('/api/sensor-simulator');
        const point = await res.json();
        setData((prev) => {
          const next = [
            ...prev,
            {
              ...point,
              time: format(new Date(point.timestamp), 'HH:mm:ss'),
            },
          ];
          return next.slice(-30); // Keep last 30 points
        });
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    };

    fetchAndAppend();
    const interval = setInterval(fetchAndAppend, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading && data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        Loading simulator...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1">
          <Droplets className="h-4 w-4 text-cyan-500" />
          Water Level (cm)
        </span>
        <span className="flex items-center gap-1">
          <CloudRain className="h-4 w-4 text-blue-500" />
          Rainfall (mm)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
          <YAxis yAxisId="left" stroke="#64748b" fontSize={11} />
          <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              value,
              name === 'water_level_cm' ? 'Water (cm)' : 'Rain (mm)',
            ]}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <ReferenceLine yAxisId="left" y={400} stroke="#f59e0b" strokeDasharray="3 3" />
          <ReferenceLine yAxisId="left" y={700} stroke="#ef4444" strokeDasharray="3 3" />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="water_level_cm"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="rainfall_mm"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500">
        Simulated sensor data (polls every 3s). Thresholds: 400cm (Waspada), 700cm (Bahaya).
      </p>
    </div>
  );
}
