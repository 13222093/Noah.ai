'use client';

// Data layers for the operator map (react-leaflet children of OperatorMap).
// - PolderLayer: one circle per polder, coloured by flood probability at the
//   selected lead time. The circle marks a reference point, not a boundary.
// - StationLayer: water-level posts, coloured by the Siaga status DSDA
//   recorded with the reading; a suspect (unchanging) sensor is hatched grey.
// Every tooltip carries its source and time (guardrail 7).
// Leaflet touches `window`; only import this from a client-only (ssr:false) tree.

import React, { useMemo } from 'react';
import Leaflet from 'leaflet';
import { Circle as _Circle, Marker as _Marker, Tooltip as _Tooltip } from 'react-leaflet';
import type { LeadMin, PolderSnapshot, StationReading } from '@/lib/ops/types';
import { formatWibTime } from '@/lib/time';
import { RiskChip, SiagaChip } from '@/components/operator/ops/Chips';
import { SourceStamp } from '@/components/operator/ops/SourceStamp';
import { NO_DATA_COLOR, QUALITY_LABEL, RISK_META, SIAGA_META, cellFor, formatPct, thresholdSourceLabel } from '@/components/operator/ops/meta';

// react-leaflet's typings clash with this project's React types; keep the casts local.
const Circle = _Circle as any;
const Marker = _Marker as any;
const Tooltip = _Tooltip as any;

// This project's types/leaflet-routing-machine.d.ts shadows the leaflet typings
// (same workaround as the original components/map/FloodMap.tsx).
const L = Leaflet as any;
type DivIcon = any;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const iconCache = new Map<string, DivIcon>();
function cachedIcon(key: string, make: () => DivIcon): DivIcon {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = make();
    iconCache.set(key, icon);
  }
  return icon;
}

export function PolderLayer({
  polders,
  lead,
  onSelect,
}: {
  polders: PolderSnapshot[];
  lead: LeadMin;
  onSelect: (polderId: string) => void;
}) {
  return (
    <>
      {polders.map((p) => {
        const cell = cellFor(p, lead);
        const meta = cell ? RISK_META[cell.category] : null;
        const color = meta?.color ?? NO_DATA_COLOR;
        const pct = cell ? formatPct(cell.probability) : '–';
        const labelKey = `pl|${p.unit.id}|${pct}|${cell?.category ?? 'none'}`;
        const label = cachedIcon(labelKey, () =>
          L.divIcon({
            className: 'ops-polder-label',
            html: `<div class="ops-polder-label__inner"><b style="color:${color}">${escapeHtml(pct)}</b><span>${escapeHtml(p.unit.name.replace(/^(Polder|Waduk)\s+/, ''))}</span></div>`,
            iconSize: [140, 36],
            iconAnchor: [70, 18],
          }),
        );
        return (
          <React.Fragment key={p.unit.id}>
            <Circle
              center={[p.unit.lat, p.unit.lon]}
              radius={p.unit.displayRadiusM}
              pathOptions={{
                color,
                weight: meta?.weight ?? 1.5,
                fillColor: color,
                fillOpacity: meta?.fillOpacity ?? 0.1,
                dashArray: cell ? undefined : '4 4',
              }}
              eventHandlers={{ click: () => onSelect(p.unit.id) }}
              bubblingMouseEvents={false}
            >
              <Tooltip direction="auto" sticky className="ops-tooltip" opacity={1}>
                <div className="w-64 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-heading text-sm font-semibold leading-tight text-op-fg">{p.unit.name}</p>
                    <RiskChip category={cell?.category} />
                  </div>
                  {cell ? (
                    <>
                      <p className="flex items-baseline gap-1.5 text-op-fg-2">
                        <span className="font-mono text-xl font-bold tabular-nums text-op-fg">{pct}</span>
                        <span className="text-xs">
                          peluang banjir dalam {lead} mnt (s.d. {formatWibTime(cell.validTo)})
                        </span>
                      </p>
                      {cell.reasons[0] && <p className="text-xs leading-snug text-op-fg-2">{cell.reasons[0]}</p>}
                      <SourceStamp provenance={cell.provenance} timeLabel="diterbitkan" />
                    </>
                  ) : (
                    <p className="text-xs text-op-fg-3">Belum ada prakiraan untuk {lead} mnt.</p>
                  )}
                  <p className="text-[11px] text-op-accent">Klik untuk membuka detail polder</p>
                </div>
              </Tooltip>
            </Circle>
            <Marker position={[p.unit.lat, p.unit.lon]} icon={label} interactive={false} keyboard={false} />
          </React.Fragment>
        );
      })}
    </>
  );
}

function stationIcon(r: StationReading): DivIcon {
  const level = r.latest?.siaga ?? 'unknown';
  const quality = r.latest?.quality ?? 'stale';
  const key = `st|${level}|${quality}`;
  return cachedIcon(key, () => {
    const meta = SIAGA_META[level];
    const suspect = quality === 'suspect';
    const stale = quality === 'stale' || !r.latest;
    const cls = ['ops-station', suspect ? 'ops-station--suspect' : '', stale ? 'ops-station--stale' : '']
      .filter(Boolean)
      .join(' ');
    const style = suspect ? '' : `background:${meta.color};color:${meta.onColor}`;
    return L.divIcon({
      className: 'ops-station-wrap',
      html: `<div class="${cls}" style="${style}">${suspect ? '!' : meta.short}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  });
}

function StationTooltipBody({ r }: { r: StationReading }) {
  const { station, latest } = r;
  const th = station.thresholds;
  const rows: Array<[string, number | null]> = [
    ['Siaga 3', th.siaga3],
    ['Siaga 2', th.siaga2],
    ['Siaga 1', th.siaga1],
  ];
  return (
    <div className="w-64 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading text-sm font-semibold leading-tight text-op-fg">{station.name}</p>
          <p className="text-[11px] text-op-fg-3">{station.river}</p>
        </div>
        {latest && <SiagaChip level={latest.siaga} />}
      </div>
      {latest ? (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold tabular-nums text-op-fg">
              {latest.cm === null ? '–' : Math.round(latest.cm)}
            </span>
            <span className="text-xs tabular-nums text-op-fg-2">cm · pukul {formatWibTime(latest.ts)}</span>
          </p>
          <p className="text-[11px] text-op-fg-3">Status Siaga sesuai catatan DSDA pada pembacaan ini.</p>
          {latest.quality !== 'ok' && (
            <p
              className={
                latest.quality === 'suspect'
                  ? 'rounded-sm border border-dashed border-op-fg-3 bg-op-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-op-fg'
                  : 'text-[11px] font-medium text-op-fg-disabled'
              }
            >
              Kualitas: {QUALITY_LABEL[latest.quality]}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-op-fg-3">Belum ada pembacaan sampai waktu ini.</p>
      )}
      <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
        {rows.map(([label, v]) => (
          <div key={label} className="rounded-sm border border-op-border bg-op-surface-1 px-1 py-0.5">
            <p className="text-op-fg-3">{label}</p>
            <p className="font-mono tabular-nums text-op-fg">{v === null ? '–' : `${v} cm`}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-op-fg-3">Batas Siaga: {thresholdSourceLabel(th.source)}</p>
      <SourceStamp provenance={r.provenance} stale={latest?.quality === 'stale' ? true : undefined} />
    </div>
  );
}

export function StationLayer({ stations }: { stations: StationReading[] }) {
  const items = useMemo(() => stations.filter((r) => Number.isFinite(r.station.lat) && Number.isFinite(r.station.lon)), [stations]);
  return (
    <>
      {items.map((r) => (
        <Marker key={r.station.id} position={[r.station.lat, r.station.lon]} icon={stationIcon(r)} zIndexOffset={500}>
          <Tooltip direction="auto" offset={[0, 0]} className="ops-tooltip" opacity={1}>
            <StationTooltipBody r={r} />
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
