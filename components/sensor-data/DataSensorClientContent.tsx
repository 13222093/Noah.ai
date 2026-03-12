'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Database as TableIcon,
  CloudRain,
  MapPin,
  Clock,
  Droplets,
  AlertCircle,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  ChevronRight,
  Activity,
  Thermometer,
  Wind,
  Cloud,
  Gauge,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { id, enUS } from 'date-fns/locale';

import { useWeatherData } from '@/hooks/useWeatherData';
import FloodReportChart from './FloodReportChart';
import { SensorSimulatorChart } from './SensorSimulatorChart';
import { useLanguage } from '@/src/context/LanguageContext';

interface LaporanBanjir {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  water_level: string;
  description?: string;
  photo_url?: string;
  reporter_name?: string;
  reporter_contact?: string;
  created_at: string;
}

const classifyWaterLevelString = (waterLevelString: string, t: (key: string) => string): {
  label: string;
  level: 'low' | 'medium' | 'high';
  colorClass: string;
  icon: React.ReactNode;
} => {
  switch (waterLevelString) {
    case 'semata_kaki':
      return { label: t('sensorData.filter.low'), level: 'low', colorClass: 'text-emerald-400 bg-emerald-500/20', icon: <Activity className="h-4 w-4" /> };
    case 'selutut':
      return { label: t('sensorData.filter.medium').split('/')[0], level: 'medium', colorClass: 'text-yellow-400 bg-yellow-500/20', icon: <Droplets className="h-4 w-4" /> };
    case 'sepaha':
      return { label: t('sensorData.filter.medium').split('/')[1] || t('sensorData.filter.medium'), level: 'medium', colorClass: 'text-orange-400 bg-orange-500/20', icon: <Droplets className="h-4 w-4" /> };
    case 'sepusar':
      return { label: t('sensorData.filter.high').split('/')[0], level: 'high', colorClass: 'text-red-400 bg-red-500/20', icon: <AlertCircle className="h-4 w-4" /> };
    case 'lebih_dari_sepusar':
      return { label: t('sensorData.filter.high').split('/')[1] || t('sensorData.filter.high'), level: 'high', colorClass: 'text-red-500 bg-red-500/30', icon: <AlertCircle className="h-4 w-4" /> };
    default:
      return { label: 'Unknown', level: 'low', colorClass: 'text-slate-400 bg-white/5', icon: <Activity className="h-4 w-4" /> };
  }
};

interface DataSensorClientContentProps {
  initialLaporan: LaporanBanjir[];
}

const DataSensorClientContent: React.FC<DataSensorClientContentProps> = ({ initialLaporan }) => {
  const { t, lang } = useLanguage();
  const [laporan] = useState<LaporanBanjir[]>(initialLaporan);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const { weatherData, isLoading: isWeatherLoading, error: weatherError, fetchWeather } = useWeatherData();

  useEffect(() => {
    fetchWeather(-6.2088, 106.8456);
  }, [fetchWeather]);

  const INITIAL_DISPLAY_LIMIT = 8;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);

  const filteredAndSortedLaporan = useMemo(() => {
    const filtered = laporan.filter(report => {
      const matchesSearch = searchTerm === '' ||
        report.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.description && report.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const level = classifyWaterLevelString(report.water_level, t).level;
      const matchesFilter = selectedFilter === 'all' || selectedFilter === level;
      return matchesSearch && matchesFilter;
    });
    return [...filtered].sort((a, b) =>
      parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime()
    );
  }, [laporan, searchTerm, selectedFilter, t]);

  const displayedReports = useMemo(() => {
    return (filteredAndSortedLaporan || []).slice(0, displayLimit);
  }, [filteredAndSortedLaporan, displayLimit]);

  const stats = useMemo(() => {
    const total = laporan.length;
    const highLevel = laporan.filter(r => classifyWaterLevelString(r.water_level, t).level === 'high').length;
    const mediumLevel = laporan.filter(r => classifyWaterLevelString(r.water_level, t).level === 'medium').length;
    const lowLevel = laporan.filter(r => classifyWaterLevelString(r.water_level, t).level === 'low').length;
    const avgLevel = total > 0 ? Math.round((highLevel * 80 + mediumLevel * 40 + lowLevel * 15) / total) : 0;
    return { total, highLevel, mediumLevel, lowLevel, avgLevel };
  }, [laporan, t]);

  const handleExportData = () => {
    if (displayedReports.length === 0) return;
    const headers = ['ID', 'Location', 'Latitude', 'Longitude', 'Water Level', 'Description', 'Reporter', 'Contact', 'Time'];
    const csvContent = [
      headers.join(','),
      ...displayedReports.map(report =>
        [
          `"${report.id}"`,
          `"${report.location}"`,
          report.latitude,
          report.longitude,
          `"${classifyWaterLevelString(report.water_level, t).label}"`,
          `"${report.description?.replace(/"/g, '""') || ''}"`,
          `"${report.reporter_name?.replace(/"/g, '""') || ''}"`,
          `"${report.reporter_contact || ''}"`,
          `"${format(parseISO(report.created_at), 'dd MMM yyyy, HH:mm', { locale: lang === 'id' ? id : enUS })}"`
        ].join(',')
      )
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'laporan_banjir.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statCards = [
    { label: t('sensorData.statistics.totalReports'), value: stats.total, badge: 'Total', icon: TableIcon, color: 'text-cyan-400', bg: 'bg-cyan-500/10', badgeColor: 'bg-cyan-500/20 text-cyan-400' },
    { label: t('sensorData.statistics.highLevel'), value: stats.highLevel, badge: 'Tinggi', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', badgeColor: 'bg-red-500/20 text-red-400', sub: '(Sepusar/Lebih)' },
    { label: t('sensorData.statistics.mediumLevel'), value: stats.mediumLevel, badge: 'Sedang', icon: Droplets, color: 'text-yellow-400', bg: 'bg-yellow-500/10', badgeColor: 'bg-yellow-500/20 text-yellow-400', sub: '(Selutut/Sepaha)' },
    { label: t('sensorData.statistics.lowLevel'), value: stats.lowLevel, badge: 'Rendah', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', badgeColor: 'bg-emerald-500/20 text-emerald-400', sub: '(Semata Kaki)' },
    { label: t('sensorData.statistics.avgLevel'), value: `${stats.avgLevel}`, unit: 'cm', badge: 'Avg', icon: Gauge, color: 'text-purple-400', bg: 'bg-purple-500/10', badgeColor: 'bg-purple-500/20 text-purple-400' },
  ];

  return (
    <div className="w-full text-white">
      <div className="space-y-6">
        {/* Page title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl">
            <TableIcon className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{t('sensorData.title')}</h1>
            <p className="text-sm text-slate-500">{t('sensorData.subtitle')}</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-xl border border-white/5 p-4 space-y-2 ${card.bg}`}>
              <div className="flex items-center justify-between">
                <card.icon size={18} className={card.color} />
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>{card.badge}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">
                  {card.value}
                  {(card as any).unit && <span className="text-sm text-slate-500 ml-0.5">{(card as any).unit}</span>}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight">{card.label}</p>
                {(card as any).sub && <p className="text-[10px] text-slate-600">{(card as any).sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 lg:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                <input
                  type="text"
                  placeholder={t('sensorData.filter.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-slate-600 text-sm"
                />
              </div>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="bg-white/5 border border-white/5 text-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500/50 text-sm"
              >
                <option value="all">{t('sensorData.filter.allLevels')}</option>
                <option value="low">{t('sensorData.filter.low')}</option>
                <option value="medium">{t('sensorData.filter.medium')}</option>
                <option value="high">{t('sensorData.filter.high')}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 bg-cyan-500/10 text-cyan-400 px-4 py-2 rounded-lg hover:bg-cyan-500/20 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>{t('sensorData.filter.export')}</span>
              </button>
              <button className="flex items-center gap-2 bg-white/5 text-slate-400 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
                <Filter className="h-4 w-4" />
                <span>{t('sensorData.filter.filter')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid: Reports + Weather Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Reports */}
          <div className="xl:col-span-2">
            <div className="bg-white/[0.03] rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <TableIcon className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-200">{t('sensorData.reports.title')}</h3>
                      <p className="text-xs text-slate-500">
                        {t('sensorData.reports.showing')} {displayedReports.length} {t('sensorData.reports.of')} {laporan.length} {t('sensorData.reports.reports')}
                      </p>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-slate-200">{displayedReports.length}</div>
                </div>
              </div>

              <div>
                {displayedReports.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {displayedReports.map((report, index) => {
                      const classification = classifyWaterLevelString(report.water_level || '', t);
                      return (
                        <motion.div
                          key={report.id || index}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="p-4 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                <h4 className="font-semibold text-sm text-slate-200">{report.location}</h4>
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${classification.colorClass}`}>
                                  {classification.icon}
                                  {classification.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(parseISO(report.created_at), 'dd MMM yyyy, HH:mm', { locale: lang === 'id' ? id : enUS })}
                                </span>
                                {report.reporter_name && (
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {report.reporter_name}
                                  </span>
                                )}
                              </div>
                              {report.description && (
                                <p className="text-xs text-slate-400 leading-relaxed">
                                  {report.description.length > 100 ? `${report.description.substring(0, 100)}...` : report.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-600 ml-3 shrink-0 mt-1" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <TableIcon className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-slate-400 mb-1">{t('sensorData.reports.noData')}</h3>
                    <p className="text-xs text-slate-600">{t('sensorData.reports.noDataDesc')}</p>
                  </div>
                )}
              </div>

              {displayedReports.length < filteredAndSortedLaporan.length && (
                <div className="p-4 border-t border-white/5">
                  <button
                    onClick={() => setDisplayLimit(filteredAndSortedLaporan.length)}
                    className="w-full border border-white/10 text-slate-400 rounded-lg px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                  >
                    {t('sensorData.reports.viewMore')} ({filteredAndSortedLaporan.length - displayedReports.length} {t('sensorData.reports.moreReports')})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Current Weather */}
            <div className="bg-white/[0.03] rounded-xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <CloudRain className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">{t('sensorData.weather.title')}</h3>
                    <p className="text-[10px] text-slate-500">{t('sensorData.weather.subtitle')}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {isWeatherLoading ? (
                  <div className="text-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">{t('sensorData.weather.loading')}</p>
                  </div>
                ) : weatherError ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                    <p className="text-xs text-red-400">{weatherError}</p>
                  </div>
                ) : weatherData ? (
                  <>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-100">{Math.round(weatherData.current.main.temp)}°C</div>
                      <div className="text-xs text-slate-400 capitalize">{weatherData.current.weather[0].description}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Droplets, value: `${weatherData.current.main.humidity}%`, label: t('sensorData.weather.humidity'), color: 'text-blue-400' },
                        { icon: Wind, value: `${weatherData.current.wind.speed} m/s`, label: t('sensorData.weather.wind'), color: 'text-emerald-400' },
                        { icon: Thermometer, value: `${weatherData.current.main.pressure} hPa`, label: t('sensorData.weather.pressure'), color: 'text-orange-400' },
                        { icon: Eye, value: `${weatherData.current.visibility / 1000} km`, label: t('sensorData.weather.visibility'), color: 'text-purple-400' },
                      ].map((item) => (
                        <div key={item.label} className="text-center bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                          <item.icon className={`h-4 w-4 ${item.color} mx-auto mb-1`} />
                          <div className="text-sm font-semibold text-slate-200">{item.value}</div>
                          <div className="text-[9px] text-slate-500">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">{t('sensorData.weather.unavailable')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Flood Report Chart */}
            <FloodReportChart />

            {/* Sensor Simulator */}
            <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                Simulated Sensor Stream
              </h3>
              <SensorSimulatorChart />
            </div>

            {/* Quick Actions */}
            <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('sensorData.actions.title')}</h3>
              <div className="space-y-2">
                {[
                  { onClick: handleExportData, icon: Download, label: t('sensorData.filter.export'), color: 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20' },
                  { onClick: () => {}, icon: Calendar, label: t('sensorData.actions.scheduleReport'), color: 'text-slate-400 bg-white/5 hover:bg-white/10' },
                  { onClick: () => {}, icon: AlertCircle, label: t('sensorData.actions.alertSettings'), color: 'text-slate-400 bg-white/5 hover:bg-white/10' },
                  { onClick: () => {}, icon: Cloud, label: t('sensorData.actions.currentWeather'), color: 'text-slate-400 bg-white/5 hover:bg-white/10' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-sm ${action.color}`}
                  >
                    <div className="flex items-center gap-2">
                      <action.icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSensorClientContent;