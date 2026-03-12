'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  Info,
  Clock,
  MapPin,
  Loader2,
  ChevronRight,
  Users,
  Droplets,
  ArrowLeft,
  Newspaper,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/src/context/LanguageContext';

interface AlertItem {
  id: string;
  level: 'low' | 'medium' | 'high';
  location: string;
  timestamp: string;
  reason: string;
  affectedAreas?: string[];
  estimatedPopulation?: number;
  severity?: number;
}

interface NewsReport {
  id: string;
  title: string;
  source: string;
  sourceColor: string;
  url?: string;
  offsetMs: number;
  region: string;
}

const allMockAlerts: AlertItem[] = [
  { id: 'alert-1', level: 'high', location: 'Bendung Katulampa', timestamp: '10:30', reason: 'TMA terpantau 210 cm (Siaga 1), tren naik.', severity: 9, affectedAreas: ['Rawajati', 'Cawang', 'Bidara Cina'], estimatedPopulation: 14850 },
  { id: 'alert-2', level: 'medium', location: 'Pintu Air Manggarai', timestamp: '10:28', reason: 'Ketinggian air 850 cm (Siaga 3), debit meningkat dari arah Depok.', severity: 7, affectedAreas: ['Bukit Duri', 'Kampung Melayu', 'Grogol'], estimatedPopulation: 8230 },
  { id: 'alert-3', level: 'low', location: 'Pos Angke Hulu', timestamp: '10:25', reason: 'TMA 150 cm (Siaga 4), kondisi masih terpantau normal.', severity: 4, affectedAreas: ['Cengkareng', 'Kembangan', 'Pesing'], estimatedPopulation: 2477 },
  { id: 'alert-4', level: 'medium', location: 'Kali Sunter', timestamp: '10:20', reason: 'Kenaikan debit air signifikan pasca hujan lokal di area hulu.', severity: 6, affectedAreas: ['Kelapa Gading Barat', 'Sunter Jaya'], estimatedPopulation: 6150 },
  { id: 'alert-5', level: 'high', location: 'Waduk Pluit', timestamp: '10:15', reason: 'Pompa air diaktifkan untuk mengurangi volume air kiriman.', severity: 8, affectedAreas: ['Penjaringan', 'Muara Angke', 'Kapuk Muara'], estimatedPopulation: 11780 },
  { id: 'alert-6', level: 'low', location: 'Cipinang Hulu', timestamp: '10:10', reason: 'Aliran deras namun masih dalam batas aman, TMA 130 cm.', severity: 3, affectedAreas: ['Makasar', 'Cipinang Melayu'], estimatedPopulation: 1520 },
  { id: 'alert-7', level: 'high', location: 'Kali Krukut', timestamp: '10:05', reason: 'Luapan air menggenangi Jl. Kemang Raya, lalulintas terganggu.', severity: 9, affectedAreas: ['Kemang', 'Cipete Selatan', 'Pela Mampang'], estimatedPopulation: 11240 },
  { id: 'alert-8', level: 'medium', location: 'Pesanggrahan', timestamp: '10:00', reason: 'Ketinggian air naik 50cm dalam 1 jam terakhir.', severity: 7, affectedAreas: ['Bintaro', 'Cipulir', 'Ulujami'], estimatedPopulation: 7490 },
];

const NEWS_ITEMS: NewsReport[] = [
  { id: 'n1', source: 'KOMPAS', sourceColor: 'text-blue-400', title: 'Banjir Bandang Terjang Agam, 3 Jembatan Putus dan Ratusan Rumah Terendam', region: 'Sumatera Barat', offsetMs: 25 * 60_000, url: 'https://www.kompas.com/tag/banjir' },
  { id: 'n2', source: 'DETIK', sourceColor: 'text-emerald-400', title: 'BPBD: Debit Air Sungai Ciliwung Terus Naik, Warga Diminta Waspada', region: 'DKI Jakarta', offsetMs: 45 * 60_000, url: 'https://news.detik.com/indeks?tag=banjir' },
  { id: 'n3', source: 'CNN ID', sourceColor: 'text-red-400', title: 'Curah Hujan Tinggi, BMKG Keluarkan Peringatan Dini Banjir untuk Jabodetabek', region: 'Nasional', offsetMs: 90 * 60_000, url: 'https://www.cnnindonesia.com/tag/banjir' },
  { id: 'n4', source: 'TEMPO', sourceColor: 'text-amber-400', title: 'Bendungan Katulampa Siaga 1, Potensi Banjir Kiriman ke Jakarta Malam Ini', region: 'Jawa Barat', offsetMs: 120 * 60_000, url: 'https://www.tempo.co/tag/banjir' },
  { id: 'n5', source: 'ANTARA', sourceColor: 'text-purple-400', title: 'Pemkot Semarang Siagakan 200 Personel untuk Antisipasi Banjir Rob', region: 'Jawa Tengah', offsetMs: 180 * 60_000, url: 'https://www.antaranews.com/tag/banjir' },
  { id: 'n6', source: 'REPUBLIKA', sourceColor: 'text-cyan-400', title: 'Tanggul Sungai Citarum Jebol, 5 Desa di Bandung Terendam Banjir', region: 'Jawa Barat', offsetMs: 240 * 60_000, url: 'https://republika.co.id/tag/banjir' },
];

export default function PeringatanPage() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'news'>('alerts');
  const [alerts] = useState<AlertItem[]>(allMockAlerts);
  const { t } = useLanguage();

  const totalAlerts = alerts.length;
  const highAlerts = useMemo(() => alerts.filter(a => a.level === 'high').length, [alerts]);
  const mediumAlerts = useMemo(() => alerts.filter(a => a.level === 'medium').length, [alerts]);
  const lowAlerts = useMemo(() => alerts.filter(a => a.level === 'low').length, [alerts]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'high': return { label: t('warnings.highLevel'), className: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'medium': return { label: t('warnings.mediumLevel'), className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'low': return { label: t('warnings.lowLevel'), className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      default: return { label: 'N/A', className: 'bg-white/5 text-slate-400' };
    }
  };

  return (
    <div className="min-h-screen bg-cc-bg text-cc-text">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3">
        <Link
          href="/dashboard?layout=tiling"
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-heading">{t('alerts.back')}</span>
        </Link>
        <span className="text-white/10">|</span>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-cyan-400" />
          <h1 className="text-sm font-bold text-slate-200 font-heading">{t('warnings.title')}</h1>
          <span className="text-[11px] text-slate-500 hidden sm:inline">— {t('warnings.subtitle')}</span>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Summary stat cards — compact, matching dashboard style */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: t('warnings.totalAlerts'), value: totalAlerts, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Bell, sub: t('warnings.active') },
            { label: t('warnings.highLevel'), value: highAlerts, color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle, sub: t('warnings.immediateAction') },
            { label: t('warnings.mediumLevel'), value: mediumAlerts, color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Info, sub: t('warnings.monitorConstantly') },
            { label: t('warnings.lowLevel'), value: lowAlerts, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Bell, sub: t('warnings.stableCondition') },
          ].map((stat) => (
            <div key={stat.label} className={cn('rounded-lg border border-white/5 p-3', stat.bg)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">{stat.label}</span>
                <stat.icon size={12} className={stat.color} />
              </div>
              <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Tab bar — matching dashboard segmented control style */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/5 w-fit">
          {[
            { id: 'alerts' as const, label: t('warnings.alertsTab'), icon: Bell },
            { id: 'news' as const, label: t('warnings.newsTab'), icon: Newspaper },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-white/10 text-slate-200'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert) => {
              const badge = getLevelBadge(alert.level);
              return (
                <div
                  key={alert.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 space-y-3"
                >
                  {/* Header: badge + time */}
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', badge.className)}>
                      {badge.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Clock size={10} /> {alert.timestamp}
                    </span>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-cyan-400 shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-200">{alert.location}</h3>
                  </div>

                  {/* Reason */}
                  <p className="text-[11px] text-slate-400 leading-snug">{alert.reason}</p>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/[0.03] rounded px-2.5 py-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Users size={10} className="text-blue-400" />
                        <span className="text-[9px] text-slate-600">{t('warnings.affected')}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-300">{alert.estimatedPopulation?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="bg-white/[0.03] rounded px-2.5 py-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Droplets size={10} className="text-cyan-400" />
                        <span className="text-[9px] text-slate-600">{t('warnings.severity')}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-300">{alert.severity}/10</span>
                    </div>
                  </div>

                  {/* Affected areas */}
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1">{t('warnings.affectedRegions')}</p>
                    <div className="flex flex-wrap gap-1">
                      {alert.affectedAreas?.map((area, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{area}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* News tab */}
        {activeTab === 'news' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-200">{t('alerts.latestFloodNews')}</span>
              </div>
              <span className="text-[10px] text-slate-500">{NEWS_ITEMS.length} {t('alerts.articles')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {NEWS_ITEMS.map((item) => {
                const mins = Math.floor(item.offsetMs / 60000);
                const timeLabel = mins < 60 ? `${mins}${t('alerts.minutesAgo')}` : `${Math.floor(mins / 60)}${t('alerts.hoursAgo')}`;
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3.5 space-y-2 block group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[9px] font-bold uppercase', item.sourceColor)}>{item.source}</span>
                      <span className="text-[9px] text-slate-600">{timeLabel}</span>
                    </div>
                    <p className="text-[12px] text-slate-300 leading-snug font-medium group-hover:text-slate-100 transition-colors">{item.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">📍 {item.region}</span>
                      <ExternalLink size={10} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
