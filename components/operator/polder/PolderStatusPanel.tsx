'use client';

// M3 polder operations panel: sump fill, time to full, pumps running,
// sump trend (drawdown or filling) and anomalies. In the replay these values
// come from a demo rule, so the whole panel carries the SIMULASI label.

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import type { PolderStatus, PolderUnit } from '@/lib/ops/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/operator/ui/empty-state';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { NO_DATA_COLOR, RISK_META, tokenColor } from '@/components/operator/ops/meta';

type Trend = 'turun' | 'naik' | 'stabil' | null;

function sumpTrend(history: PolderStatus[]): Trend {
  const pts = history.filter((s) => s.sumpFillPct !== null);
  if (pts.length < 2) return null;
  const a = pts[Math.max(0, pts.length - 4)].sumpFillPct as number;
  const b = pts[pts.length - 1].sumpFillPct as number;
  if (b - a <= -1) return 'turun';
  if (b - a >= 1) return 'naik';
  return 'stabil';
}

const TREND_META = {
  // Icon colour only: a filling pond is a rising risk (tinggi); the label stays neutral.
  turun: { label: 'Muka kolam turun', hint: 'Pompa menurunkan muka air (drawdown).', icon: ArrowDownRight, cls: 'text-op-fg-2' },
  naik: { label: 'Kolam sedang terisi', hint: 'Aliran masuk lebih besar dari kapasitas pompa yang menyala.', icon: ArrowUpRight, cls: 'text-op-risk-tinggi' },
  stabil: { label: 'Muka kolam stabil', hint: 'Aliran masuk seimbang dengan pemompaan.', icon: Minus, cls: 'text-op-fg-3' },
} as const;

function formatDuration(min: number): string {
  const m = Math.round(min);
  if (m < 120) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} jam` : `${h} j ${r} mnt`;
}

/** Pond fill on the risk scale: 50% is the drawdown trigger. */
function fillColor(pct: number): string {
  if (pct >= 85) return RISK_META.sangat_tinggi.color;
  if (pct >= 65) return RISK_META.tinggi.color;
  if (pct >= 50) return RISK_META.sedang.color;
  return RISK_META.rendah.color;
}

function SumpGauge({ pct }: { pct: number | null }) {
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const color = pct === null ? NO_DATA_COLOR : fillColor(v);
  return (
    <div className="flex items-end gap-3">
      <div
        className="relative h-20 w-12 overflow-hidden rounded-md border border-white/10 bg-white/5"
        role="meter"
        aria-label="Isi kolam"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct === null ? undefined : Math.round(v)}
      >
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${v}%`, backgroundColor: color, opacity: 0.85 }} />
        {/* 50% marks the drawdown trigger in the trigger-to-action table */}
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-op-fg-2" aria-hidden />
        <span className="absolute right-0.5 top-1/2 -translate-y-full text-[9px] tabular-nums text-op-fg-2" aria-hidden>
          50%
        </span>
      </div>
      <div>
        <p className="text-xl font-bold leading-none tabular-nums text-op-fg">{pct === null ? '–' : `${Math.round(v)}%`}</p>
        <p className="mt-1 text-xs text-op-fg-2">isi kolam</p>
      </div>
    </div>
  );
}

export function PolderStatusPanel({
  unit,
  status,
  history,
}: {
  unit: PolderUnit | null;
  status: PolderStatus | null;
  history: PolderStatus[];
}) {
  const trend = sumpTrend(history);
  const spark = history.filter((s) => s.sumpFillPct !== null).map((s) => ({ t: Date.parse(s.provenance.ts), v: s.sumpFillPct }));
  const simulated = status?.provenance.kind === 'simulated' || history.some((s) => s.provenance.kind === 'simulated');

  return (
    <section className="rounded-lg border border-white/5 bg-op-surface-1 p-3" aria-labelledby="m3-title">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 id="m3-title" className="text-[11px] font-semibold uppercase tracking-wider text-op-fg">
            Operasi polder: kolam dan pompa
          </h2>
          {simulated && (
            <p className="mt-0.5 text-[10px] text-op-fg-3">Belum ada data SCADA; nilai di panel ini dihitung aturan demo, bukan pengukuran.</p>
          )}
        </div>
        {(simulated || !status) && <SimulasiBadge />}
      </div>

      {!status ? (
        <EmptyState title="Belum ada status polder" description="Status kolam dan pompa tampil di sini setelah tersedia." className="py-4" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SumpGauge pct={status.sumpFillPct} />
            <div className="space-y-3 text-right">
              <div>
                <p className="text-lg font-bold leading-none tabular-nums text-op-fg">
                  {status.timeToFullMin === null ? '–' : formatDuration(status.timeToFullMin)}
                </p>
                <p className="mt-1 text-xs text-op-fg-2">
                  {status.timeToFullMin === null ? 'kolam tidak sedang terisi' : 'perkiraan sampai kolam penuh'}
                </p>
              </div>
              <div>
                <p className="text-lg font-bold leading-none tabular-nums text-op-fg">
                  {status.pumpsOn}
                  <span className="text-xs text-op-fg-3">/{status.pumpsTotal}</span>
                </p>
                <p className="mt-1 text-xs text-op-fg-2">pompa menyala</p>
                <div className="mt-1 flex justify-end gap-1" aria-hidden>
                  {Array.from({ length: status.pumpsTotal }, (_, i) => (
                    <span key={i} className={cn('h-2.5 w-2.5 rounded-[2px] border', i < status.pumpsOn ? 'border-op-fg bg-op-fg' : 'border-op-border-strong bg-transparent')} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className={cn(
                'rounded-lg border px-2.5 py-2',
                status.drawdownState === 'wet' ? 'border-op-accent/30 bg-op-accent/10' : 'border-white/5 bg-op-surface-2',
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Status drawdown</p>
              {status.drawdownState ? (
                <>
                  <p className={cn('mt-0.5 text-xs', status.drawdownState === 'wet' ? 'font-bold text-op-fg' : 'font-semibold text-op-fg-2')}>
                    {status.drawdownState === 'wet' ? 'Basah: drawdown pre-emptif disarankan' : 'Kering: operasi normal'}
                  </p>
                  <p className="text-[10px] leading-snug text-op-fg-3">
                    {status.drawdownState === 'wet'
                      ? 'Turunkan muka kolam sebelum hujan/limpasan datang.'
                      : 'Belum perlu menurunkan muka kolam lebih awal.'}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-xs text-op-fg-3">Belum tersedia</p>
              )}
            </div>
            <div className="rounded-lg border border-white/5 bg-op-surface-2 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Aliran (m³/s)</p>
              <p className="mt-0.5 font-mono text-xs tabular-nums text-op-fg">
                masuk {status.inflowM3s === undefined ? '–' : status.inflowM3s.toFixed(2)}
              </p>
              <p className="font-mono text-xs tabular-nums text-op-fg">
                pompa {status.outflowM3s === undefined ? '–' : status.outflowM3s.toFixed(2)}
              </p>
            </div>
          </div>

          {trend && (
            <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-op-surface-2 px-2.5 py-2">
              {(() => {
                const Icon = TREND_META[trend].icon;
                return <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TREND_META[trend].cls)} aria-hidden />;
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-op-fg">{TREND_META[trend].label}</p>
                <p className="text-[10px] text-op-fg-2">{TREND_META[trend].hint}</p>
              </div>
              {spark.length > 1 && (
                <div className="h-9 w-24 shrink-0" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <YAxis hide domain={[0, 100]} />
                      <Area type="monotone" dataKey="v" stroke={tokenColor('fg-2')} fill={tokenColor('fg-3')} fillOpacity={0.2} strokeWidth={1.5} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {status.anomalies.length > 0 && (
            <ul className="space-y-1.5">
              {status.anomalies.map((a) => (
                <li key={a} className="flex items-start gap-2 rounded-lg border border-white/5 border-l-2 border-l-op-risk-tinggi bg-op-risk-tinggi/5 px-3 py-2 text-xs text-op-fg">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-op-risk-tinggi" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {unit && unit.pumps.length > 0 && (
            <details className="group text-xs text-op-fg-2">
              <summary className="cursor-pointer select-none text-op-fg-2 hover:text-op-fg">Daftar pompa ({unit.pumps.length})</summary>
              <ul className="mt-1.5 space-y-0.5 pl-3">
                {unit.pumps.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>{p.name}</span>
                    <span className="tabular-nums text-op-fg-3">{p.capacityM3s === null ? 'kapasitas tidak diketahui' : `${p.capacityM3s} m³/s`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <SourceStamp provenance={status.provenance} />
        </div>
      )}
    </section>
  );
}
