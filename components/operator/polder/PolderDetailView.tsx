'use client';

// Polder detail: probability per lead time, linked water-level posts against
// their Siaga lines with rain, probability history, sump and pump status (M3),
// and this polder's recommendations. Data stops at the replay time.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Info, LineChart as LineChartIcon, Waves } from 'lucide-react';
import {
  useAcknowledgements,
  useLevelSeries,
  useNowcastHistory,
  useOpsSnapshot,
  usePolders,
  usePolderStatusHistory,
  useRainSeries,
  useStations,
} from '@/lib/ops/hooks';
import { LEAD_TIMES, type LeadMin, type NowcastCell, type Provenance, type Station, type StationReading } from '@/lib/ops/types';
import { recStatus, usePolderRecommendations, useReplayWindow } from '@/hooks/useOps';
import { cn } from '@/lib/utils';
import { formatWibTime } from '@/lib/time';
import { EmptyState } from '@/components/operator/ui/empty-state';
import { SimulasiBadge } from '@/components/operator/demo/SimulasiBadge';
import { RiskChip, SiagaChip } from '@/components/operator/ops/Chips';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { CHART, NO_DATA_COLOR, RISK_META, formatPct, thresholdSourceLabel } from '@/components/operator/ops/meta';
import { RecommendationCard } from '@/components/operator/rekomendasi/RecommendationCard';
import { AckDialog } from '@/components/operator/rekomendasi/AckDialog';
import type { Recommendation } from '@/lib/ops/types';
import { PostLevelChart } from './PostLevelChart';
import { LeadLegend, ProbabilityHistoryChart } from './ProbabilityHistoryChart';
import { PolderStatusPanel } from './PolderStatusPanel';

function Panel({
  title,
  icon: Icon,
  badge,
  children,
  className,
  right,
}: {
  title: string;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-white/5 bg-op-surface-1 p-3', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-op-fg">
          {Icon && <Icon className="h-3 w-3 text-op-accent" aria-hidden />}
          {title}
          {badge}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function LeadTile({ lead, cell, selected, onSelect }: { lead: LeadMin; cell: NowcastCell | null; selected: boolean; onSelect: () => void }) {
  const color = cell ? RISK_META[cell.category].color : NO_DATA_COLOR;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-op-surface-2 p-2.5 text-left transition-colors',
        selected ? 'border-op-accent ring-1 ring-op-accent' : 'border-white/5 hover:bg-op-surface-3',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-2">dalam {lead} mnt</p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-op-fg">
        {cell ? formatPct(cell.probability) : '–'}
      </p>
      <div className="mt-2">
        <RiskChip category={cell?.category} />
      </div>
      {cell && (
        <p className="mt-1.5 hidden text-[10px] tabular-nums text-op-fg-3 sm:block">
          {formatWibTime(cell.validFrom).replace(' WIB', '')}–{formatWibTime(cell.validTo)}
        </p>
      )}
    </button>
  );
}

function LevelPanel({
  stations,
  polderId,
  startIso,
  startMs,
  endMs,
  nowMs,
  latestByStation,
  rainProvenance,
}: {
  rainProvenance: Provenance | null;
  stations: Station[];
  polderId: string;
  startIso: string;
  startMs: number;
  endMs: number;
  nowMs: number;
  latestByStation: Map<string, StationReading>;
}) {
  const [stationId, setStationId] = useState<string | null>(null);
  const station = stations.find((s) => s.id === stationId) ?? stations[0] ?? null;
  const levels = useLevelSeries(station?.id ?? '', startIso);
  const rain = useRainSeries(polderId, startIso);
  const reading = station ? latestByStation.get(station.id) : undefined;

  return (
    <Panel
      title="Tinggi muka air dan hujan"
      icon={Waves}
      right={
        stations.length > 1 ? (
          <div role="tablist" aria-label="Pos duga air" className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-black/30 p-0.5">
            {stations.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={station?.id === s.id}
                onClick={() => setStationId(s.id)}
                className={cn(
                  'flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-all duration-150',
                  station?.id === s.id ? 'bg-op-accent-fill text-op-on-accent shadow-sm' : 'text-op-fg-2 hover:bg-white/5 hover:text-op-fg',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      {!station ? (
        <EmptyState title="Belum ada pos duga air terhubung" description="Pos DSDA yang terkait dengan polder ini tampil di sini." className="py-6" />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-[13px] font-semibold text-op-fg">
              {station.name} <span className="text-xs text-op-fg-3">· {station.river}</span>
            </p>
            {reading?.latest && (
              <>
                <span className="text-lg font-bold tabular-nums text-op-fg">
                  {reading.latest.cm === null ? '–' : `${Math.round(reading.latest.cm)} cm`}
                </span>
                <SiagaChip level={reading.latest.siaga} />
                {reading.latest.quality === 'suspect' && (
                  <span className="rounded border border-dashed border-op-fg-3 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-op-fg">
                    Sensor tidak berubah: diragukan
                  </span>
                )}
              </>
            )}
          </div>
          {levels.length === 0 && rain.length === 0 ? (
            <EmptyState title="Belum ada pembacaan sampai waktu ini" className="py-8" />
          ) : (
            <PostLevelChart station={station} levels={levels} rain={rain} startMs={startMs} endMs={endMs} nowMs={nowMs} />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-op-fg-2">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-5" style={{ backgroundColor: CHART.level }} aria-hidden /> Tinggi muka air (cm)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 opacity-50" style={{ backgroundColor: CHART.rain }} aria-hidden /> Hujan per jam (mm)
            </span>
            <span>Garis putus: batas Siaga 3/2/1 ({thresholdSourceLabel(station.thresholds.source)})</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <SourceStamp provenance={reading?.provenance} stale={reading?.latest?.quality === 'stale' ? true : undefined} />
            {rain.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-op-fg-3">
                <span>Hujan:</span>
                {rainProvenance ? <SourceStamp provenance={rainProvenance} /> : <span>sumber belum tersedia</span>}
                {rainProvenance?.kind === 'reanalysis' && <span>(perkiraan kasar per jam di titik polder, bukan alat ukur di lokasi)</span>}
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

export function PolderDetailView({ polderId }: { polderId: string }) {
  const polders = usePolders();
  const allStations = useStations();
  const snapshot = useOpsSnapshot();
  const { startIso, endIso, nowMs } = useReplayWindow();
  const { acks } = useAcknowledgements();
  const [lead, setLead] = useState<LeadMin>(120);
  const [ackFor, setAckFor] = useState<Recommendation | null>(null);

  const unit = polders.find((p) => p.id === polderId) ?? null;
  const snap = snapshot?.polders.find((p) => p.unit.id === polderId) ?? null;
  const history = useNowcastHistory(polderId, startIso ?? '');
  const statusHistory = usePolderStatusHistory(polderId, startIso ?? '');
  const recs = usePolderRecommendations(polderId);

  const stations = unit ? unit.stationIds.map((id) => allStations.find((s) => s.id === id)).filter((s): s is Station => !!s) : [];
  const rainProvenance =
    snapshot?.health.find((h) => /hujan|rain|meteo|era5|reanal/i.test(`${h.id} ${h.label} ${h.provenance.source}`))?.provenance ?? null;
  const latestByStation = new Map((snapshot?.stations ?? []).map((r) => [r.station.id, r]));
  const startMs = startIso ? Date.parse(startIso) : null;
  const endMs = endIso ? Date.parse(endIso) : null;
  const cells = snap?.nowcast ?? [];
  const cellAt = (l: LeadMin) => cells.find((c) => c.leadMin === l) ?? null;
  const selectedCell = cellAt(lead);
  const nowcastSimulated = cells.some((c) => c.provenance.kind === 'simulated') || history.some((c) => c.provenance.kind === 'simulated');

  if (polders.length > 0 && !unit) {
    return (
      <div className="p-6">
        <EmptyState title="Polder tidak ditemukan" description={`Tidak ada polder dengan kode "${polderId}".`}>
          <Link href="/operator/polder" className="text-xs text-op-accent hover:underline">
            Lihat daftar polder
          </Link>
        </EmptyState>
      </div>
    );
  }

  const open = recs.filter((r) => nowMs !== null && Date.parse(r.windowEnd) > nowMs);
  const past = recs.filter((r) => !open.includes(r));

  return (
    <div className="min-h-full bg-op-page px-3 pb-4 pt-2.5 text-op-fg sm:px-4">
      {/* Header */}
      <div className="mb-3">
        <Link href="/operator" className="inline-flex items-center gap-1 text-[11px] text-op-fg-2 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Ringkasan
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Polder</p>
            <h1 className="text-base font-bold leading-tight">{unit?.name ?? polderId}</h1>
            {unit?.note && (
              <p className="mt-1 flex max-w-3xl items-start gap-1.5 text-xs text-op-fg-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {unit.note}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Probability per lead */}
      <section aria-label="Peluang banjir per waktu ke depan" className="mb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-op-fg">Peluang banjir</h2>
          {nowcastSimulated && <SimulasiBadge />}
          <span className="text-[10px] text-op-fg-3">Ketuk salah satu untuk melihat alasannya.</span>
        </div>
        {cells.length === 0 ? (
          <EmptyState title="Belum ada prakiraan untuk polder ini" className="rounded-lg border border-white/5 bg-op-surface-1 py-6" />
        ) : (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid grid-cols-3 gap-2">
              {LEAD_TIMES.map((l) => (
                <LeadTile key={l} lead={l} cell={cellAt(l)} selected={lead === l} onSelect={() => setLead(l)} />
              ))}
            </div>
            <div className="rounded-lg border border-white/5 bg-op-surface-2 p-3">
              <p className="text-[13px] font-semibold text-op-fg">Mengapa {selectedCell ? formatPct(selectedCell.probability) : '–'} dalam {lead} menit?</p>
              {selectedCell && selectedCell.reasons.length > 0 ? (
                <ol className="mt-2 space-y-1.5">
                  {selectedCell.reasons.map((r, i) => (
                    <li key={r} className="flex gap-2 text-xs leading-snug text-op-fg">
                      <span className="mt-px font-mono text-[10px] tabular-nums text-op-fg-3">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-op-fg-3">Belum ada alasan untuk waktu ini.</p>
              )}
              <div className="mt-3">
                <SourceStamp provenance={selectedCell?.provenance} timeLabel="diterbitkan" />
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <div className="min-w-0 space-y-3">
          {startIso && startMs !== null && endMs !== null && nowMs !== null ? (
            <>
              <LevelPanel
                stations={stations}
                polderId={polderId}
                startIso={startIso}
                startMs={startMs}
                endMs={endMs}
                nowMs={nowMs}
                latestByStation={latestByStation}
                rainProvenance={rainProvenance}
              />
              <Panel title="Riwayat peluang banjir" icon={LineChartIcon} badge={nowcastSimulated ? <SimulasiBadge /> : undefined} right={<LeadLegend />}>
                {history.length === 0 ? (
                  <EmptyState title="Belum ada riwayat prakiraan" className="py-6" />
                ) : (
                  <ProbabilityHistoryChart history={history} startMs={startMs} endMs={endMs} nowMs={nowMs} />
                )}
                <p className="mt-2 text-[10px] text-op-fg-3">Tiap titik adalah prakiraan yang diterbitkan pada jam tersebut; tidak ada data sesudah waktu replay.</p>
              </Panel>
            </>
          ) : (
            <EmptyState title="Jam replay belum berjalan" className="rounded-lg border border-white/5 bg-op-surface-1 py-8" />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <PolderStatusPanel unit={unit} status={snap?.status ?? null} history={statusHistory} />

          <Panel title="Rekomendasi untuk polder ini" icon={ClipboardCheck} right={<Link href="/operator/rekomendasi" className="text-xs text-blue-400 transition-colors hover:text-blue-300">Semua</Link>}>
            {recs.length === 0 ? (
              <EmptyState title="Belum ada rekomendasi" description="Saran muncul di sini saat aturan pemicu terpenuhi." className="py-4" />
            ) : (
              <div className="space-y-3">
                {open.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Terbuka</p>
                    {open.map((r) => (
                      <RecommendationCard
                        key={r.id}
                        compact
                        rec={r}
                        polderName={unit?.name ?? r.polderId}
                        ack={acks[r.id]}
                        status={recStatus(r, acks[r.id], nowMs)}
                        onAck={() => setAckFor(r)}
                      />
                    ))}
                  </div>
                )}
                {past.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-op-fg-3">Sebelumnya</p>
                    {past.map((r) => (
                      <RecommendationCard
                        key={r.id}
                        compact
                        rec={r}
                        polderName={unit?.name ?? r.polderId}
                        ack={acks[r.id]}
                        status={recStatus(r, acks[r.id], nowMs)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AckDialog
        rec={ackFor}
        polderName={unit?.name ?? ''}
        open={!!ackFor}
        onOpenChange={(o) => !o && setAckFor(null)}
      />
    </div>
  );
}
