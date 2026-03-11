'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { TilePanel } from './TilePanel';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Waves, Activity, Search, ChevronDown, ChevronUp, Shield, MapPin, Users, ExternalLink } from 'lucide-react';
import type { SegmentedTab } from './SegmentedControl';
import { cn } from '@/lib/utils';

const BOTTOM_TABS: SegmentedTab[] = [
  { id: 'infrastructure', label: 'Infrastructure', icon: Waves },
  { id: 'earthquake', label: 'Earthquake', icon: Activity },
  { id: 'evacuation', label: 'Evacuation', icon: Shield },
];

export function BottomTile() {
  const data = useDashboardData();
  const [activeTab, setActiveTab] = useLocalStorage('noah-bottom-tab', 'infrastructure');
  const [waterSearch, setWaterSearch] = useState('');
  const [pumpSearch, setPumpSearch] = useState('');
  const [evacSearch, setEvacSearch] = useState('');
  const [waterExpanded, setWaterExpanded] = useState(true);
  const [pumpExpanded, setPumpExpanded] = useState(true);

  // Evacuation data
  const [evacLocations, setEvacLocations] = useState<any[]>([]);
  const [evacLoading, setEvacLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'evacuation' && evacLocations.length === 0) {
      setEvacLoading(true);
      fetch('/api/evacuation')
        .then(res => res.json())
        .then(data => setEvacLocations(Array.isArray(data) ? data : []))
        .catch(() => setEvacLocations([]))
        .finally(() => setEvacLoading(false));
    }
  }, [activeTab]);

  const filteredEvac = useMemo(() => {
    if (!evacSearch) return evacLocations;
    return evacLocations.filter((loc: any) =>
      loc.name?.toLowerCase().includes(evacSearch.toLowerCase()) ||
      loc.address?.toLowerCase().includes(evacSearch.toLowerCase()),
    );
  }, [evacLocations, evacSearch]);

  const filteredWaterPosts = useMemo(() => {
    if (!data.waterLevelPosts) return [];
    if (!waterSearch) return data.waterLevelPosts;
    return data.waterLevelPosts.filter((p: any) =>
      p.name?.toLowerCase().includes(waterSearch.toLowerCase()),
    );
  }, [data.waterLevelPosts, waterSearch]);

  const filteredPumps = useMemo(() => {
    if (!data.pumpStatusData) return [];
    if (!pumpSearch) return data.pumpStatusData;
    return data.pumpStatusData.filter((p: any) =>
      p.nama?.toLowerCase().includes(pumpSearch.toLowerCase()) ||
      p.lokasi?.toLowerCase().includes(pumpSearch.toLowerCase()),
    );
  }, [data.pumpStatusData, pumpSearch]);

  const statusColor = (status: string) => {
    if (status === 'Bahaya') return 'text-red-400';
    if (status?.includes('Siaga')) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'infrastructure':
        return (
          <div className="flex flex-col h-full">
            {/* Side-by-side panels */}
            <div className="flex-1 flex gap-[2px] overflow-hidden min-h-0">
              {/* Left: Water Levels */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01]">
                {/* Accordion header */}
                <button
                  onClick={() => setWaterExpanded(!waterExpanded)}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-white/[0.03] border-b border-white/5 hover:bg-white/[0.05] transition-colors shrink-0"
                >
                  <div className="flex items-center gap-1.5">
                    <Waves size={13} className="text-cyan-400" />
                    <span className="text-[11px] font-medium text-slate-300">Lihat Status Tinggi Air</span>
                  </div>
                  {waterExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                </button>
                {waterExpanded && (
                  <>
                    {/* Search */}
                    <div className="px-2 py-1 shrink-0">
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                          value={waterSearch}
                          onChange={(e) => setWaterSearch(e.target.value)}
                          placeholder="Cari pos air..."
                          className="w-full bg-white/5 rounded pl-6 pr-2 py-1 text-[11px] text-slate-300 placeholder:text-slate-600 border border-white/5 focus:border-blue-500/50 outline-none"
                        />
                      </div>
                    </div>
                    {/* Table header */}
                    <div className="grid grid-cols-4 gap-1 px-3 py-1 text-[9px] font-semibold text-slate-500 uppercase border-b border-white/5 shrink-0">
                      <span>Pos</span>
                      <span>Tinggi</span>
                      <span>Status</span>
                      <span>Pembaruan</span>
                    </div>
                    {/* Table body */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredWaterPosts.map((post: any, i: number) => (
                        <div
                          key={post.id || i}
                          className="grid grid-cols-4 gap-1 px-3 py-1 text-[11px] border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                        >
                          <span className="text-slate-300 truncate font-medium">{post.name}</span>
                          <span className="text-slate-400">{post.tinggi} m</span>
                          <span className={cn('font-medium', statusColor(post.status))}>
                            {post.status}
                          </span>
                          <span className="text-slate-600 text-[10px]">{post.lastUpdate || '--'}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Right: Pump Status */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.01]">
                {/* Accordion header */}
                <button
                  onClick={() => setPumpExpanded(!pumpExpanded)}
                  className="flex items-center justify-between w-full px-3 py-1.5 bg-white/[0.03] border-b border-white/5 hover:bg-white/[0.05] transition-colors shrink-0"
                >
                  <div className="flex items-center gap-1.5">
                    <Activity size={13} className="text-yellow-400" />
                    <span className="text-[11px] font-medium text-slate-300">Lihat Status Pompa Banjir</span>
                  </div>
                  {pumpExpanded ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                </button>
                {pumpExpanded && (
                  <>
                    {/* Search */}
                    <div className="px-2 py-1 shrink-0">
                      <div className="relative">
                        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                          value={pumpSearch}
                          onChange={(e) => setPumpSearch(e.target.value)}
                          placeholder="Cari pompa..."
                          className="w-full bg-white/5 rounded pl-6 pr-2 py-1 text-[11px] text-slate-300 placeholder:text-slate-600 border border-white/5 focus:border-blue-500/50 outline-none"
                        />
                      </div>
                    </div>
                    {/* Table header */}
                    <div className="grid grid-cols-3 gap-1 px-3 py-1 text-[9px] font-semibold text-slate-500 uppercase border-b border-white/5 shrink-0">
                      <span>Nama Pompa</span>
                      <span>Lokasi</span>
                      <span>Status</span>
                    </div>
                    {/* Table body */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredPumps.map((pump: any, i: number) => (
                        <div
                          key={pump.id || i}
                          className="grid grid-cols-3 gap-1 px-3 py-1 text-[11px] border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                        >
                          <span className="text-slate-300 truncate font-medium">{pump.nama}</span>
                          <span className="text-slate-400 truncate">{pump.lokasi}</span>
                          <span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                                pump.status === 'Aktif'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : pump.status === 'Maintenance'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400',
                              )}
                            >
                              <span className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                pump.status === 'Aktif' ? 'bg-emerald-500' :
                                pump.status === 'Maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                              )} />
                              {pump.status}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 'earthquake':
        return (
          <div className="p-3">
            {data.latestQuake ? (
              <div className="flex gap-4 items-start">
                <div className="text-center shrink-0">
                  <p className="text-2xl font-bold text-yellow-400">
                    {data.latestQuake.Magnitude || '--'}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Magnitude</p>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>📍 {data.latestQuake.Wilayah || 'Unknown'}</p>
                  <p>🕐 {data.latestQuake.Tanggal} {data.latestQuake.Jam}</p>
                  <p>📏 Depth: {data.latestQuake.Kedalaman || '--'}</p>
                  <p>📐 Distance: {data.latestQuake.Dirasakan || '--'}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {data.quakeError || 'No recent earthquake data'}
              </p>
            )}
          </div>
        );

      case 'evacuation':
        return (
          <div className="flex flex-col h-full">
            {/* Search */}
            <div className="px-2 py-1 shrink-0">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={evacSearch}
                  onChange={(e) => setEvacSearch(e.target.value)}
                  placeholder="Cari lokasi evakuasi..."
                  className="w-full bg-white/5 rounded pl-6 pr-2 py-1 text-[11px] text-slate-300 placeholder:text-slate-600 border border-white/5 focus:border-blue-500/50 outline-none"
                />
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {evacLoading ? (
                <div className="text-center py-6 text-xs text-slate-500">Loading evacuation data...</div>
              ) : filteredEvac.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">Belum ada data lokasi evakuasi</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredEvac.map((loc: any, i: number) => {
                    const pct = loc.capacity_total > 0
                      ? Math.round((loc.capacity_current / loc.capacity_total) * 100)
                      : 0;
                    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-emerald-500';
                    const statusColor = loc.operational_status === 'Buka'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : loc.operational_status === 'Penuh'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400';
                    return (
                      <div
                        key={loc.id || i}
                        className="rounded-md bg-white/[0.03] border border-white/5 p-2.5 space-y-1.5 hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[11px] font-semibold text-slate-200 leading-tight">{loc.name}</p>
                          <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0', statusColor)}>
                            {loc.operational_status || 'N/A'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin size={9} className="shrink-0" />
                          <span className="truncate">{loc.address || '--'}</span>
                        </p>
                        {/* Capacity bar */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Users size={9} /> Kapasitas
                            </span>
                            <span className="text-slate-300 font-medium">{loc.capacity_current}/{loc.capacity_total}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <TilePanel
      tabs={BOTTOM_TABS}
      activeTab={activeTab}
      onTabChange={(id) => { setActiveTab(id); setWaterSearch(''); setPumpSearch(''); }}
      tabVariant="text"
      seeFullRoute={
        activeTab === 'infrastructure' ? '/sensor-data'
        : activeTab === 'evacuation' ? '/evacuation'
        : undefined
      }
      seeFullLabel="See Full"
    >
      {renderContent()}
    </TilePanel>
  );
}
