'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import {
  TrendingUp,
  Activity,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { normalizeSeries, ChartRow } from '@/lib/utils';
import { useLanguage } from '@/src/context/LanguageContext';

// Generate random mock data
const generateRandomData = (days: number) => {
  const data = [];
  const regions = ['Jakarta', 'Bandung', 'Surabaya', 'Medan', 'Yogyakarta', 'Lainnya'];
  for (let i = 0; i < days; i++) {
    const date = subDays(new Date(), i);
    for (const region of regions) {
      data.push({
        date: date.toISOString(),
        region,
        laporan: Math.floor(Math.random() * 20) + 1,
        resolved: Math.floor(Math.random() * 15) + 1,
      });
    }
  }
  return data;
};

interface ChartData {
  line: ChartRow[];
  bar: ChartRow[];
  pie: ChartRow[];
}

const DATA_KEYS = ['jumlah', 'resolved'];

const StatisticsDashboard = () => {
  const { t } = useLanguage();
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartData>({ line: [], bar: [], pie: [] });
  const [masterData, setMasterData] = useState(() => generateRandomData(90));

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      setMasterData(generateRandomData(90));
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    const fetchData = () => {
      setIsLoading(true);
      const days = parseInt(selectedTimeRange.replace('d', '').replace('h', ''));
      const isHours = selectedTimeRange.includes('h');
      const now = new Date();
      let dataToProcess;

      if (selectedTimeRange === '30d') {
        dataToProcess = generateRandomData(30);
      } else if (selectedTimeRange === '90d') {
        dataToProcess = generateRandomData(90);
      } else {
        const cutoff = isHours ? subDays(now, days / 24) : subDays(now, days);
        dataToProcess = masterData.filter((d) => new Date(d.date) >= cutoff);
      }

      const line = normalizeSeries(
        dataToProcess
          .reduce((acc, curr) => {
            const day = format(parseISO(curr.date), 'yyyy-MM-dd');
            const existing = acc.find((item) => item.date === day);
            if (existing) {
              existing.jumlah += curr.laporan ?? 0;
              existing.resolved += curr.resolved ?? 0;
            } else {
              acc.push({
                date: day,
                day: format(parseISO(curr.date), 'eee'),
                jumlah: curr.laporan ?? 0,
                resolved: curr.resolved ?? 0,
              });
            }
            return acc;
          }, [] as ChartRow[])
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        DATA_KEYS,
      ) as ChartRow[];

      const bar = normalizeSeries(
        dataToProcess.reduce((acc, curr) => {
          const existing = acc.find((item) => item.name === curr.region);
          if (existing) {
            existing.jumlah += curr.laporan ?? 0;
          } else {
            acc.push({ name: curr.region, jumlah: curr.laporan ?? 0 });
          }
          return acc;
        }, [] as ChartRow[]),
        DATA_KEYS,
      ) as ChartRow[];

      setChartData({ line, bar, pie: bar });
      setIsLoading(false);
    };

    fetchData();
  }, [selectedTimeRange, masterData]);

  const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      return (
        <div className="bg-[#0f1729] border border-white/10 text-white p-3 rounded-lg shadow-xl">
          <p className="font-bold text-cyan-400 text-sm">{label}</p>
          {dataItem.jumlah !== undefined && (
            <p className="text-xs text-slate-300">{`${t('sensorData.charts.reports')}: ${dataItem.jumlah}`}</p>
          )}
          {dataItem.resolved !== undefined && (
            <p className="text-xs text-slate-300">{`${t('sensorData.charts.resolved')}: ${dataItem.resolved}`}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const timeRangeOptions = [
    { value: '24h', label: t('sensorData.filter.timeRange.h24') },
    { value: '7d', label: t('sensorData.filter.timeRange.d7') },
    { value: '30d', label: t('sensorData.filter.timeRange.d30') },
    { value: '90d', label: t('sensorData.filter.timeRange.d90') },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Time Range Filter */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">{t('sensorData.statistics.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedTimeRange(opt.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                selectedTimeRange === opt.value
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar Chart: Most Vulnerable */}
          <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {t('sensorData.charts.mostVulnerable')}
            </h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                {chartData.bar && chartData.bar.length > 0 ? (
                  <BarChart data={chartData.bar} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.08)' }} />
                    <Bar dataKey="jumlah" fill="#2dd4bf" radius={[4, 4, 0, 0]} name={t('sensorData.charts.reports')} />
                  </BarChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-600">
                    {t('sensorData.charts.noData')}
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart: Flood Trend */}
          <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {t('sensorData.charts.floodTrend')}
            </h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                {Array.isArray(chartData.line) && chartData.line.length > 0 ? (
                  <LineChart data={chartData.line} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    <Line type="monotone" dataKey="jumlah" stroke="#2dd4bf" strokeWidth={2} activeDot={{ r: 6, fill: '#2dd4bf' }} dot={false} name={t('sensorData.charts.reports')} />
                    <Line type="monotone" dataKey="resolved" stroke="#818cf8" strokeWidth={2} dot={false} name={t('sensorData.charts.resolved')} />
                  </LineChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-600">
                    {t('sensorData.charts.noData')}
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Report Composition */}
          <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {t('sensorData.charts.reportComposition')}
            </h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                {Array.isArray(chartData.pie) && chartData.pie.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={chartData.pie}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={95}
                      fill="#8884d8"
                      dataKey="jumlah"
                      nameKey="name"
                    >
                      {chartData.pie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                  </PieChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-600">
                    {t('sensorData.charts.noData')}
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stacked Bar Chart: Daily & Resolved */}
          <div className="bg-white/[0.03] rounded-xl border border-white/5 p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              {t('sensorData.charts.dailyResolved')}
            </h3>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                {chartData.line && chartData.line.length > 0 ? (
                  <BarChart data={chartData.line} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(100, 116, 139, 0.08)' }} content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    <Bar dataKey="jumlah" stackId="a" fill="#2dd4bf" name={t('sensorData.charts.total')} />
                    <Bar dataKey="resolved" stackId="a" fill="#818cf8" name={t('sensorData.charts.resolved')} />
                  </BarChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-600">
                    {t('sensorData.charts.noData')}
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard;
