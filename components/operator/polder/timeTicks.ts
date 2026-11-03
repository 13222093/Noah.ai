// Fixed time ticks for the replay charts: whole WIB hours, every `everyH` hours.

import { getWibParts } from '@/lib/time';

export function wibHourTicks(startMs: number, endMs: number, maxTicks = 11): number[] {
  const hours = (endMs - startMs) / 3_600_000;
  const steps = [1, 2, 3, 6, 12, 24];
  const every = steps.find((h) => hours / h <= maxTicks) ?? 24;
  const out: number[] = [];
  for (let ms = Math.ceil(startMs / 3_600_000) * 3_600_000; ms <= endMs; ms += 3_600_000) {
    if (getWibParts(ms).hour % every === 0) out.push(ms);
  }
  return out;
}
