'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TilePanel } from './TilePanel';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/src/context/LanguageContext';
import { Waves, Activity, Search, ChevronDown, ChevronUp, ChevronRight, Shield, MapPin, Users, ExternalLink, BarChart3, Droplets, AlertCircle, TrendingUp, Gauge, Globe, Wrench, UserCheck, Video, Newspaper, Clock, XCircle, CheckCircle, AlertTriangle, Info, Phone, Zap, HeartPulse } from 'lucide-react';
import type { SegmentedTab } from './SegmentedControl';
import { cn } from '@/lib/utils';
import { CCTV_CHANNELS } from '@/lib/constants';

const BOTTOM_TABS: SegmentedTab[] = [
  { id: 'evacuation', label: 'Evacuation', icon: Shield },
  { id: 'cctv', label: 'CCTV AI', icon: Video },
  { id: 'berita', label: 'Berita Regional', icon: Newspaper },
  { id: 'sensor', label: 'Data Sensor', icon: Gauge },
  { id: 'status', label: 'Statistik', icon: BarChart3 },
  { id: 'infrastructure', label: 'Infrastructure', icon: Waves },
  { id: 'earthquake', label: 'Earthquake', icon: Activity },
];

export function BottomTile() {
  const data = useDashboardData();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useLocalStorage('noah-bottom-tab', 'evacuation');
  const [waterSearch, setWaterSearch] = useState('');
  const [pumpSearch, setPumpSearch] = useState('');
  const [evacSearch, setEvacSearch] = useState('');
  const [waterExpanded, setWaterExpanded] = useState(true);
  const [pumpExpanded, setPumpExpanded] = useState(true);
  const [selectedEvacLocation, setSelectedEvacLocation] = useState<any>(null);

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
      p.nama_infrastruktur?.toLowerCase().includes(pumpSearch.toLowerCase()) ||
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
                    <span className="text-[11px] font-medium text-slate-300">{t('infrastructure.viewWaterLevel')}</span>
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
                          placeholder={t('infrastructure.searchWaterPost')}
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
                      {filteredWaterPosts.map((post: any, i: number) => {
                        // Relative time helper
                        const ts = post.timestamp;
                        let ago = '--';
                        if (ts) {
                          const diffMs = Date.now() - new Date(ts).getTime();
                          const mins = Math.floor(diffMs / 60000);
                          if (mins < 1) ago = 'Baru saja';
                          else if (mins < 60) ago = `${mins} menit yang lalu`;
                          else ago = `${Math.floor(mins / 60)} jam yang lalu`;
                        }
                        return (
                          <div
                            key={post.id || i}
                            className="grid grid-cols-4 gap-1 px-3 py-1 text-[11px] border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                          >
                            <span className="text-slate-300 truncate font-medium">{post.name}</span>
                            <span className="text-slate-400 font-semibold">{post.water_level ?? '--'} {post.unit || 'm'}</span>
                            <span className={cn('font-medium', statusColor(post.status))}>
                              {post.status}
                            </span>
                            <span className="text-slate-600 text-[10px]">{ago}</span>
                          </div>
                        );
                      })}
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
                    <span className="text-[11px] font-medium text-slate-300">{t('infrastructure.viewPumpStatus')}</span>
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
                          placeholder={t('infrastructure.searchPump')}
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
                          <span className="text-slate-300 truncate font-medium">{pump.nama_infrastruktur || pump.nama}</span>
                          <span className="text-slate-400 truncate">{pump.lokasi}</span>
                          <span>
                            {(() => {
                              const st = pump.kondisi_bangunan || pump.status || 'N/A';
                              return (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                                    st === 'Aktif'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : st === 'Maintenance'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-red-500/20 text-red-400',
                                  )}
                                >
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    st === 'Aktif' ? 'bg-emerald-500' :
                                    st === 'Maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                                  )} />
                                  {st}
                                </span>
                              );
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {/* Summary Stats — matches Floodzy */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-white/5 shrink-0">
              <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/5">
                <p className="text-[9px] text-slate-500 uppercase">Pos Air Dipantau</p>
                <p className="text-lg font-bold text-slate-200">{data.waterLevelPosts?.length || 0}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/5">
                <p className="text-[9px] text-slate-500 uppercase">Total Pompa</p>
                <p className="text-lg font-bold text-slate-200">{data.pumpStatusData?.length || 0}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/5">
                <p className="text-[9px] text-slate-500 uppercase">Pompa Aktif</p>
                <p className="text-lg font-bold text-emerald-400">
                  {data.pumpStatusData?.filter((p: any) => (p.kondisi_bangunan || p.status) === 'Aktif').length || 0}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/5">
                <p className="text-[9px] text-slate-500 uppercase">Zona Rawan</p>
                <p className="text-lg font-bold text-amber-400">
                  {data.waterLevelPosts?.filter((p: any) => p.status !== 'Normal').length || 0}
                </p>
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
                        onClick={() => setSelectedEvacLocation(loc)}
                        className="rounded-md bg-white/[0.03] border border-white/5 p-2.5 space-y-1.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
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


      case 'sensor':
        {
          const posts = data.waterLevelPosts || [];
          const total = posts.length;
          const bahaya = posts.filter((p: any) => p.status === 'Bahaya').length;
          const waspada = posts.filter((p: any) => p.status?.includes('Siaga')).length;
          const normal = posts.filter((p: any) => p.status === 'Normal').length;
          const avgLevel = total > 0
            ? (posts.reduce((sum: number, p: any) => sum + (parseFloat(p.tinggi) || 0), 0) / total).toFixed(1)
            : '0';

          const statCards = [
            { label: 'Total Laporan', value: total, sub: '', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10', badge: 'Total', badgeColor: 'bg-blue-500/20 text-blue-400' },
            { label: 'Level Bahaya', value: bahaya, sub: '(Sepusar/Lebih)', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', badge: 'Tinggi', badgeColor: 'bg-red-500/20 text-red-400' },
            { label: 'Level Waspada', value: waspada, sub: '(Selutut/Sepaha)', icon: Droplets, color: 'text-yellow-400', bg: 'bg-yellow-500/10', badge: 'Sedang', badgeColor: 'bg-yellow-500/20 text-yellow-400' },
            { label: 'Level Normal', value: normal, sub: '(Semata Kaki)', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', badge: 'Rendah', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
            { label: 'Rata-rata Level', value: `${avgLevel}cm`, sub: '', icon: Gauge, color: 'text-purple-400', bg: 'bg-purple-500/10', badge: 'Avg', badgeColor: 'bg-purple-500/20 text-purple-400' },
          ];

          return (
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Analisis Data Sensor</h3>
                  <p className="text-[10px] text-slate-500">Monitoring laporan banjir dan data cuaca real-time</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {statCards.map((card) => (
                  <div key={card.label} className={cn('rounded-lg border border-white/5 p-2.5 space-y-1', card.bg)}>
                    <div className="flex items-center justify-between">
                      <card.icon size={14} className={card.color} />
                      <span className={cn('text-[8px] font-semibold px-1.5 py-0.5 rounded-full', card.badgeColor)}>{card.badge}</span>
                    </div>
                    <p className="text-xl font-bold text-slate-200">{card.value}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{card.label}</p>
                    {card.sub && <p className="text-[9px] text-slate-600">{card.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        }

      case 'status':
        {
          const alerts = data.realTimeAlerts || [];
          const pumps = data.pumpStatusData || [];
          const totalAlerts = alerts.length;
          const evacuees = alerts.reduce((sum: number, a: any) => sum + (a.affectedAreas?.length || 0) * 3500, 0);
          const infraDamage = Math.floor(totalAlerts * 150 + pumps.filter((p: any) => p.status !== 'Aktif').length * 80);
          const regionsAffected = new Set(alerts.map((a: any) => a.regionId)).size;
          const activePumps = pumps.filter((p: any) => p.status === 'Aktif').length;
          const readiness = pumps.length > 0 ? Math.round((activePumps / pumps.length) * 100) : 85;

          const statusCards = [
            { label: 'TOTAL INSIDEN', value: totalAlerts, trend: `↗ ${Math.round(totalAlerts * 1.2)}%`, trendColor: 'text-red-400', icon: AlertCircle, color: 'text-blue-400', bg: 'bg-blue-500/10', sub: 'Insiden tercatat' },
            { label: 'PENGUNGSI', value: evacuees.toLocaleString('id-ID'), trend: `↗ 20%`, trendColor: 'text-red-400', icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', sub: 'Orang dievakuasi' },
            { label: 'INFRASTRUKTUR RUSAK', value: infraDamage.toLocaleString('id-ID'), trend: `↘ 8%`, trendColor: 'text-emerald-400', icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10', sub: 'Bangunan & fasilitas' },
            { label: 'WILAYAH TERDAMPAK', value: regionsAffected, trend: `↗ 3%`, trendColor: 'text-yellow-400', icon: Globe, color: 'text-teal-400', bg: 'bg-teal-500/10', sub: 'Kabupaten/Kota' },
            { label: 'POMPA AKTIF', value: `${activePumps}/${pumps.length}`, trend: `${readiness}%`, trendColor: readiness > 70 ? 'text-emerald-400' : 'text-red-400', icon: Gauge, color: 'text-purple-400', bg: 'bg-purple-500/10', sub: 'Kesiapsiagaan pompa' },
            { label: 'KESIAPSIAGAAN', value: `${readiness}%`, trend: `↗ 2%`, trendColor: 'text-emerald-400', icon: UserCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/10', sub: 'Skor nasional' },
          ];

          return (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-blue-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Dashboard Statistik</h3>
                    <p className="text-[10px] text-slate-500">Monitoring dan analisis data bencana Indonesia</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time Data
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {statusCards.map((card) => (
                  <div key={card.label} className={cn('rounded-lg border border-white/5 p-2.5 space-y-1', card.bg)}>
                    <div className="flex items-center justify-between">
                      <card.icon size={14} className={card.color} />
                      <span className={cn('text-[9px] font-medium', card.trendColor)}>{card.trend}</span>
                    </div>
                    <p className="text-lg font-bold text-slate-200">{card.value}</p>
                    <p className="text-[9px] text-slate-500 uppercase font-semibold leading-tight">{card.label}</p>
                    <p className="text-[9px] text-slate-600">{card.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

      case 'cctv':
        {
          // Sort: flooded first, then online, then offline
          const sorted = [...CCTV_CHANNELS].sort((a, b) => {
            if (a.is_flooded !== b.is_flooded) return a.is_flooded ? -1 : 1;
            if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
            return 0;
          });
          const onlineCount = CCTV_CHANNELS.filter(c => c.status === 'online').length;
          const floodedCount = CCTV_CHANNELS.filter(c => c.is_flooded).length;
          const normalCount = onlineCount - floodedCount;
          const offlineCount = CCTV_CHANNELS.length - onlineCount;

          return (
            <div className="p-3 space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">CCTV Flood Detection</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  🟢 {onlineCount}/{CCTV_CHANNELS.length} Online
                </span>
              </div>

              <div className="flex gap-2">
                {/* Camera cards grid */}
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {sorted.map((ch) => {
                    const scanTime = ch.lastScanOffsetMs > 0
                      ? (() => {
                          const mins = Math.floor(ch.lastScanOffsetMs / 60000);
                          return mins < 1 ? 'Baru saja' : `${mins}m lalu`;
                        })()
                      : '--';

                    const borderClass = ch.is_flooded
                      ? 'border-red-500/50'
                      : ch.status === 'online'
                        ? 'border-emerald-500/30'
                        : 'border-white/5';

                    const bgClass = ch.is_flooded
                      ? 'bg-red-500/5'
                      : ch.status === 'online'
                        ? 'bg-emerald-500/5'
                        : 'bg-white/[0.02]';

                    return (
                      <div
                        key={ch.id}
                        className={cn(
                          'rounded-lg border p-2 space-y-1.5',
                          borderClass,
                          bgClass,
                          ch.is_flooded && 'data-pulse',
                        )}
                      >
                        {/* Camera placeholder */}
                        <div className="aspect-video bg-slate-900 rounded flex items-center justify-center relative overflow-hidden">
                          <Video size={16} className={cn(
                            'opacity-40',
                            ch.status === 'offline' ? 'text-slate-700' : 'text-slate-500',
                          )} />
                          {/* Status badge overlay */}
                          <span className={cn(
                            'absolute top-1 right-1 text-[7px] font-bold px-1 py-0.5 rounded',
                            ch.is_flooded ? 'bg-red-600 text-white' :
                            ch.status === 'online' ? 'bg-emerald-600 text-white' :
                            'bg-slate-700 text-slate-400',
                          )}>
                            {ch.is_flooded ? '🔴 BANJIR' : ch.status === 'online' ? '🟢 NORMAL' : '⚪ OFF'}
                          </span>
                        </div>

                        {/* Info */}
                        <p className="text-[10px] font-semibold text-slate-300 truncate">{ch.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500">{scanTime}</span>
                          {ch.status === 'online' && (
                            <span className={cn(
                              'text-[9px] font-bold',
                              ch.flood_probability >= 0.7 ? 'text-red-400' :
                              ch.flood_probability >= 0.3 ? 'text-yellow-400' :
                              'text-emerald-400',
                            )}>
                              {Math.round(ch.flood_probability * 100)}%
                            </span>
                          )}
                        </div>
                        {/* Confidence bar */}
                        {ch.status === 'online' && (
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                ch.flood_probability >= 0.7 ? 'bg-red-500' :
                                ch.flood_probability >= 0.3 ? 'bg-yellow-500' :
                                'bg-emerald-500',
                              )}
                              style={{ width: `${Math.round(ch.flood_probability * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary panel */}
                <div className="w-36 shrink-0 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Ringkasan</p>
                  {floodedCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-red-400">🔴 Banjir</span>
                      <span className="text-xs font-bold text-red-400">{floodedCount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400">🟢 Normal</span>
                    <span className="text-xs font-bold text-emerald-400">{normalCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">⚪ Offline</span>
                    <span className="text-xs font-bold text-slate-500">{offlineCount}</span>
                  </div>
                  <div className="border-t border-white/5 pt-1.5">
                    <p className="text-[9px] text-slate-600">Model: YOLOv8</p>
                    <p className="text-[9px] text-slate-600">Scan: Auto 3s</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

      case 'berita':
        {
          const NEWS_ITEMS = [
            {
              id: 1,
              source: 'KOMPAS',
              sourceColor: 'text-blue-400',
              headline: 'Banjir Bandang Terjang Agam, 3 Jembatan Putus dan Ratusan Rumah Terendam',
              summary: 'Banjir bandang melanda Kab. Agam pagi ini, menyebabkan 3 jembatan penghubung antar desa putus total. Ratusan rumah terendam hingga 1,5 meter.',
              region: 'Sumatera Barat',
              offsetMs: 25 * 60_000,
              severity: 'high' as const,
              url: 'https://kompas.com',
              time: '12:22',
            },
            {
              id: 2,
              source: 'DETIK',
              sourceColor: 'text-emerald-400',
              headline: 'BPBD: Debit Air Sungai Ciliwung Terus Naik, Warga Diminta Waspada',
              summary: 'BPBD DKI Jakarta memantau debit Sungai Ciliwung yang terus naik sejak dini hari. Warga bantaran sungai diminta bersiap evakuasi.',
              region: 'DKI Jakarta',
              offsetMs: 45 * 60_000,
              severity: 'medium' as const,
              url: 'https://detik.com',
              time: '12:02',
            },
            {
              id: 3,
              source: 'CNN ID',
              sourceColor: 'text-red-400',
              headline: 'Curah Hujan Tinggi, BMKG Keluarkan Peringatan Dini Banjir untuk Jabodetabek',
              summary: 'BMKG mengeluarkan peringatan dini cuaca ekstrem dengan potensi hujan lebat disertai petir dan angin kencang di wilayah Jabodetabek.',
              region: 'Nasional',
              offsetMs: 90 * 60_000,
              severity: 'high' as const,
              url: 'https://cnnindonesia.com',
              time: '11:17',
            },
            {
              id: 4,
              source: 'TEMPO',
              sourceColor: 'text-amber-400',
              headline: 'Bendungan Katulampa Siaga 1, Potensi Banjir Kiriman ke Jakarta Malam Ini',
              summary: 'Ketinggian air di Bendungan Katulampa mencapai Siaga 1. Diprediksi banjir kiriman akan tiba di Jakarta dalam 8-10 jam.',
              region: 'Jawa Barat',
              offsetMs: 120 * 60_000,
              severity: 'high' as const,
              url: 'https://tempo.co',
              time: '10:47',
            },
            {
              id: 5,
              source: 'ANTARA',
              sourceColor: 'text-purple-400',
              headline: 'Pemkot Semarang Siagakan 200 Personel untuk Antisipasi Banjir Rob',
              summary: 'Pemerintah Kota Semarang menerjunkan 200 personel gabungan untuk mengantisipasi potensi banjir rob di pesisir utara.',
              region: 'Jawa Tengah',
              offsetMs: 180 * 60_000,
              severity: 'low' as const,
              url: 'https://antaranews.com',
              time: '09:47',
            },
            {
              id: 6,
              source: 'REPUBLIKA',
              sourceColor: 'text-cyan-400',
              headline: 'Tanggul Sungai Citarum Jebol, 5 Desa di Bandung Terendam Banjir',
              summary: 'Tanggul Sungai Citarum di Kabupaten Bandung jebol akibat debit air tinggi. Lima desa terendam, ribuan warga mengungsi.',
              region: 'Jawa Barat',
              offsetMs: 240 * 60_000,
              severity: 'high' as const,
              url: 'https://republika.co.id',
              time: '08:47',
            },
          ];

          return (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper size={14} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">Berita & Laporan Regional</span>
                  <span className="text-[9px] text-slate-600">— Ringkasan AI dari berbagai sumber</span>
                </div>
                <span className="text-[10px] text-slate-500">{NEWS_ITEMS.length} artikel terbaru</span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                {NEWS_ITEMS.map((item) => {
                  const mins = Math.floor(item.offsetMs / 60000);
                  const timeLabel = mins < 60 ? `${mins}m lalu` : `${Math.floor(mins / 60)}j lalu`;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-lg border p-3 space-y-2 shrink-0 w-[260px]',
                        item.severity === 'high' ? 'border-red-500/20 bg-red-500/[0.03]'
                          : item.severity === 'medium' ? 'border-yellow-500/20 bg-yellow-500/[0.03]'
                          : 'border-white/5 bg-white/[0.02]',
                      )}
                    >
                      {/* Source + badge */}
                      <div className="flex items-center justify-between">
                        <span className={cn('text-[9px] font-bold uppercase', item.sourceColor)}>{item.source}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">📍 {item.region}</span>
                      </div>

                      {/* Headline */}
                      <p className="text-[11px] text-slate-200 leading-snug font-semibold line-clamp-2">{item.headline}</p>

                      {/* Time */}
                      <div className="flex items-center gap-1 text-[9px] text-slate-500">
                        <Clock size={9} />
                        <span>{item.time} WIB</span>
                        <span className="text-slate-700">·</span>
                        <span>{timeLabel}</span>
                      </div>

                      {/* Ringkasan */}
                      <div className="bg-white/[0.03] rounded p-2 border border-white/5">
                        <p className="text-[9px] text-cyan-400 font-semibold mb-0.5">📋 Ringkasan:</p>
                        <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{item.summary}</p>
                      </div>

                      {/* Baca Selengkapnya */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                      >
                        Baca Selengkapnya <ChevronRight size={10} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

      default:
        return null;
    }
  };

  return (
    <>
      <TilePanel
        tabs={BOTTOM_TABS}
        activeTab={activeTab}
        onTabChange={(id) => { setActiveTab(id); setWaterSearch(''); setPumpSearch(''); }}
        tabVariant="text"
        seeFullRoute={
          activeTab === 'infrastructure' ? '/sensor-data'
          : activeTab === 'evacuation' ? '/evacuation'
          : activeTab === 'sensor' ? '/sensor-data'
          : activeTab === 'status' ? '/statistics'
          : activeTab === 'cctv' ? '/cctv-simulation'
          : activeTab === 'berita' ? '/alerts'
          : undefined
        }
        seeFullLabel="See Full"
      >
        {renderContent()}
      </TilePanel>

      {/* Evacuation Detail Modal */}
      <AnimatePresence>
        {selectedEvacLocation && (() => {
          const loc = selectedEvacLocation;
          const pct = loc.capacity_total > 0 ? Math.round((loc.capacity_current / loc.capacity_total) * 100) : 0;
          const getOpsStatus = (status: string) => {
            const s = (status || '').toLowerCase();
            if (s.includes('buka') || s.includes('open')) return { text: 'Buka', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle size={10} /> };
            if (s.includes('penuh') || s.includes('full')) return { text: 'Penuh', cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle size={10} /> };
            if (s.includes('tutup') || s.includes('closed')) return { text: 'Tutup', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <AlertTriangle size={10} /> };
            return { text: status || 'N/A', cls: 'bg-white/5 text-slate-400', icon: <Info size={10} /> };
          };
          const ops = getOpsStatus(loc.operational_status);
          const capBadge = pct >= 100
            ? { text: 'Penuh', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
            : pct >= 70
            ? { text: 'Hampir Penuh', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
            : { text: 'Tersedia', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
          const getServiceIcon = (key: string, value: string) => {
            const ok = value?.toLowerCase().includes('tersedia') || value?.toLowerCase().includes('available');
            const color = ok ? 'text-emerald-400' : 'text-red-400';
            switch (key) {
              case 'clean_water': return <Droplets className={`w-3.5 h-3.5 ${color}`} />;
              case 'electricity': return <Zap className={`w-3.5 h-3.5 ${color}`} />;
              case 'medical_support': return <HeartPulse className={`w-3.5 h-3.5 ${color}`} />;
              default: return <Info className={`w-3.5 h-3.5 text-slate-400`} />;
            }
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
              onClick={() => setSelectedEvacLocation(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-cc-bg border border-white/10 rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-200">{loc.name}</h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">{loc.address}</p>
                    </div>
                    <button onClick={() => setSelectedEvacLocation(null)} className="text-slate-600 hover:text-slate-300 transition-colors">
                      <XCircle size={16} />
                    </button>
                  </div>

                  {/* Status + Capacity */}
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} className="text-cyan-400" />
                        <span className="text-[11px] text-slate-300 font-medium">Status Operasional</span>
                      </div>
                      <span className={cn('text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1', ops.cls)}>
                        {ops.icon} {ops.text}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-blue-400" />
                        <span className="text-[11px] text-slate-300 font-medium">Kapasitas</span>
                      </div>
                      <span className={cn('text-[9px] px-2 py-0.5 rounded-full border', capBadge.cls)}>
                        {capBadge.text}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Terisi:</span>
                      <span className="text-slate-300 font-medium">{loc.capacity_current} / {loc.capacity_total}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>

                  {/* Essential services */}
                  {loc.essential_services && (
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <h4 className="text-[11px] text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                        <Info size={12} className="text-emerald-400" /> Layanan Tersedia
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(loc.essential_services).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded px-2 py-1.5">
                            {getServiceIcon(key, value as string)}
                            <span className="text-[9px] text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Facilities */}
                  {loc.facilities && loc.facilities.length > 0 && (
                    <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                      <h4 className="text-[11px] text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                        <CheckCircle size={12} className="text-blue-400" /> Fasilitas
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {loc.facilities.map((f: string, i: number) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 space-y-2">
                    <h4 className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
                      <Phone size={12} className="text-amber-400" /> Kontak
                    </h4>
                    {loc.contact_person && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Penanggung jawab:</span>
                        <span className="text-slate-300">{loc.contact_person}</span>
                      </div>
                    )}
                    {loc.contact_phone && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Telepon:</span>
                        <a href={`tel:${loc.contact_phone}`} className="text-cyan-400 hover:text-cyan-300">{loc.contact_phone}</a>
                      </div>
                    )}
                    {loc.last_updated && (
                      <div className="flex items-center justify-between text-[9px] pt-1 border-t border-white/5">
                        <span className="text-slate-600">Update terakhir:</span>
                        <span className="text-slate-500">{new Date(loc.last_updated).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>

                  {/* Navigate button */}
                  <button
                    onClick={() => window.open(`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`, '_blank')}
                    className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-xs font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={12} />
                    Navigasi ke Lokasi
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
