'use client';

import React from 'react';

interface SparklineProps {
  /** Array of numeric data points (e.g., water levels over time) */
  data: number[];
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Override stroke color (defaults to trend-based: rising=critical, falling=safe) */
  color?: string;
  className?: string;
}

/**
 * Tiny inline SVG sparkline for showing trends at a glance.
 * Automatically colors red if rising (danger), green if falling (receding).
 */
export function Sparkline({ data, width = 40, height = 16, color, className }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Build SVG polyline points
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 2) - 1; // 1px padding
      return `${x},${y}`;
    })
    .join(' ');

  // Trend: rising (last > first) = danger, falling = safe
  const isRising = data[data.length - 1] > data[0];
  const strokeColor = color || (isRising ? 'var(--cc-critical)' : 'var(--cc-safe)');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
