'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { TilePanel } from './TilePanel';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useAirPollutionData } from '@/hooks/useAirPollutionData';
import { useAppStore } from '@/lib/store';
import { AlertTriangle, Activity, Cloud, Wind, BarChart3, Clock, Bot, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SegmentedTab } from './SegmentedControl';

const RIGHT_TABS: SegmentedTab[] = [
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'weather', label: 'Weather', icon: Cloud },
  { id: 'aqi', label: 'AQI', icon: Wind },
  { id: 'ai', label: 'AI Chat', icon: Bot },
];

const SEE_FULL_ROUTES: Record<string, string> = {
  alerts: '/alerts',
  weather: '/current-weather',
  aqi: '/current-weather',
};

// AQI level mapping (OpenWeatherMap 1-5 scale)
const AQI_LEVELS: Record<number, { label: string; color: string; recommendation: string }> = {
  1: { label: 'Baik', color: 'text-emerald-400', recommendation: 'Kualitas udara memuaskan' },
  2: { label: 'Cukup', color: 'text-lime-400', recommendation: 'Kualitas udara dapat diterima' },
  3: { label: 'Sedang', color: 'text-yellow-400', recommendation: 'Kelompok sensitif harus mengurangi aktivitas luar' },
  4: { label: 'Buruk', color: 'text-orange-400', recommendation: 'Kurangi aktivitas luar ruangan' },
  5: { label: 'Sangat Buruk', color: 'text-red-400', recommendation: 'Hindari aktivitas luar ruangan' },
};

// Relative time helper
function timeAgo(timestamp?: string | number): string {
  if (!timestamp) return '--';
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(then)) return '--';
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit yang lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  return `${Math.floor(hours / 24)} hari yang lalu`;
}

export function RightTile() {
  const data = useDashboardData();
  const [activeTab, setActiveTab] = useLocalStorage('noah-right-tab', 'alerts');
  const selectedLocation = useAppStore((s) => s.selectedLocation);

  // Weather data
  const { weatherData, isLoading: weatherLoading, fetchWeather } = useWeatherData();

  // AQI data
  const { airPollutionData, isLoading: aqiLoading, fetchAirPollutionData } = useAirPollutionData();

  // Fetch weather + AQI when location changes
  useEffect(() => {
    const lat = selectedLocation?.latitude;
    const lon = selectedLocation?.longitude;
    if (lat && lon) {
      fetchWeather(lat, lon);
      fetchAirPollutionData(lat, lon);
    }
  }, [selectedLocation?.latitude, selectedLocation?.longitude]);

  // Sort water levels by severity for sensor tab
  const topSensors = useMemo(() => {
    const severity: Record<string, number> = { Bahaya: 0, 'Siaga 3': 1, 'Siaga 2': 2, 'Siaga 1': 3, Normal: 4 };
    return [...(data.waterLevelPosts || [])]
      .sort((a, b) => (severity[a.status] ?? 5) - (severity[b.status] ?? 5))
      .slice(0, 10);
  }, [data.waterLevelPosts]);

  // Pump summary stats
  const pumpStats = useMemo(() => {
    const pumps = data.pumpStatusData || [];
    const total = pumps.length;
    const active = pumps.filter((p: any) => p.status === 'Aktif').length;
    const offline = pumps.filter((p: any) => p.status === 'Offline' || p.status === 'Tidak Beroperasi').length;
    const maintenance = pumps.filter((p: any) => p.status === 'Maintenance' || p.status === 'Perbaikan').length;
    return { total, active, offline: total - active - maintenance, maintenance };
  }, [data.pumpStatusData]);

  // Recent water level activity (sorted by recency)
  const recentActivity = useMemo(() => {
    return [...(data.waterLevelPosts || [])]
      .slice(0, 5);
  }, [data.waterLevelPosts]);

  // Parse AQI data
  const aqiValue = airPollutionData?.main?.aqi;
  const aqiComponents = airPollutionData?.components;
  const aqiInfo = aqiValue ? AQI_LEVELS[aqiValue] : null;

  // ---- AI Chat state ----
  interface ChatMsg { id: string; text: string; isUser: boolean; }
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { id: 'welcome', text: 'Halo! Saya noah.ai assistant. Tanyakan tentang banjir, cuaca, atau infrastruktur.', isUser: false },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), text, isUser: true };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.answer || data.error || 'Tidak ada respons.',
        isUser: false,
      }]);
    } catch {
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Gagal terhubung. Coba lagi.',
        isUser: false,
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading]);

  const chatSuggestions = [
    'Status banjir Jakarta',
    'Cuaca hari ini',
    'Kondisi pompa',
    'Info gempa terkini',
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'alerts':
        return (
          <div className="p-2 space-y-2">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs">
              <span className="text-red-400 font-semibold">
                ⚡ {data.realTimeAlerts?.length || 0} peringatan aktif
              </span>
            </div>
            {(data.realTimeAlerts || []).slice(0, 15).map((alert: any, i: number) => {
              // Severity mapping
              const levelMap: Record<string, { label: string; color: string; border: string; bg: string }> = {
                critical: { label: 'KRITIKAL', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10' },
                danger:   { label: 'BAHAYA', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
                warning:  { label: 'PERINGATAN', color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
                info:     { label: 'INFO', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
              };
              const sev = levelMap[alert.level] || levelMap.info;

              // Relative time
              const elapsed = alert.timestamp ? Date.now() - new Date(alert.timestamp).getTime() : 0;
              const mins = Math.floor(elapsed / 60000);
              const relTime = mins < 1 ? 'Baru saja'
                : mins < 60 ? `${mins} mnt yang lalu`
                : mins < 1440 ? `${Math.floor(mins / 60)} jam yang lalu`
                : `${Math.floor(mins / 1440)} hari yang lalu`;

              return (
                <div
                  key={alert.id || i}
                  className={cn('rounded-lg border px-3 py-2.5 space-y-1.5', sev.border, sev.bg)}
                >
                  {/* Header: title + severity badge */}
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {alert.title || 'Peringatan Banjir'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[9px] font-extrabold uppercase tracking-wider', sev.color)}>
                      {sev.label}
                    </span>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span className="text-[10px] text-slate-500">🕐 {relTime}</span>
                  </div>

                  {/* Affected areas */}
                  {alert.affectedAreas?.length > 0 && (
                    <p className="text-[10px] text-slate-500">
                      👥 Terdampak: {alert.affectedAreas.join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'weather':
        return (
          <div className="p-3 space-y-3">
            {weatherLoading ? (
              <div className="text-center py-6 text-xs text-slate-500">Loading weather...</div>
            ) : weatherData?.current ? (
              <>
                <div className="text-center py-2">
                  <p className="text-3xl font-light text-slate-200">
                    {Math.round(weatherData.current.main?.temp ?? 0)}°C
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {weatherData.current.weather?.[0]?.description || 'N/A'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Feels like {Math.round(weatherData.current.main?.feels_like ?? 0)}°C
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="bg-white/5 rounded p-2">
                    <p className="text-slate-600 text-[10px]">Humidity</p>
                    <p>{weatherData.current.main?.humidity ?? '--'}%</p>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <p className="text-slate-600 text-[10px]">Wind</p>
                    <p>{((weatherData.current.wind?.speed ?? 0) * 3.6).toFixed(1)} km/h</p>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <p className="text-slate-600 text-[10px]">Pressure</p>
                    <p>{weatherData.current.main?.pressure ?? '--'} hPa</p>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <p className="text-slate-600 text-[10px]">Visibility</p>
                    <p>{((weatherData.current.visibility ?? 0) / 1000).toFixed(1)} km</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-3xl font-light text-slate-200">--°C</p>
                <p className="text-xs text-slate-500 mt-1">Select a location to see weather</p>
              </div>
            )}
          </div>
        );

      case 'aqi':
        return (
          <div className="p-3 space-y-3">
            {aqiLoading ? (
              <div className="text-center py-6 text-xs text-slate-500">Loading AQI...</div>
            ) : aqiInfo ? (
              <>
                <div className="text-center py-2">
                  <p className={`text-4xl font-bold ${aqiInfo.color}`}>{aqiValue}</p>
                  <p className={`text-sm font-medium mt-1 ${aqiInfo.color}`}>{aqiInfo.label}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{aqiInfo.recommendation}</p>
                </div>
                {aqiComponents && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-semibold text-slate-500 uppercase">Pollutants</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: 'pm2_5', label: 'PM2.5', unit: 'µg/m³' },
                        { key: 'pm10', label: 'PM10', unit: 'µg/m³' },
                        { key: 'no2', label: 'NO₂', unit: 'µg/m³' },
                        { key: 'o3', label: 'O₃', unit: 'µg/m³' },
                        { key: 'so2', label: 'SO₂', unit: 'µg/m³' },
                        { key: 'co', label: 'CO', unit: 'µg/m³' },
                      ].map(({ key, label, unit }) => (
                        <div key={key} className="bg-white/5 rounded p-2">
                          <p className="text-slate-600 text-[10px]">{label}</p>
                          <p className="text-slate-400">
                            {(aqiComponents as any)[key]?.toFixed(1) ?? '--'} {unit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-4xl font-bold text-slate-600">--</p>
                <p className="text-xs text-slate-500 mt-1">Select a location to see AQI</p>
              </div>
            )}
          </div>
        );

      case 'ai':
        return (
          <div className="flex flex-col h-full">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={cn('flex', msg.isUser ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                    msg.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.06] border border-white/5 text-slate-300'
                  )}>
                    {!msg.isUser && (
                      <div className="flex items-center gap-1 mb-1">
                        <Bot size={10} className="text-cyan-400" />
                        <span className="text-[9px] font-semibold text-cyan-400">noah.ai</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.06] border border-white/5 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      <span className="text-[10px] text-slate-500 ml-1">Menganalisis...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions (only show if few messages) */}
            {chatMessages.length <= 1 && (
              <div className="px-2 pb-1.5 flex flex-wrap gap-1">
                {chatSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendChat(s)}
                    className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="shrink-0 border-t border-white/5 p-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                  placeholder="Tanya noah..."
                  disabled={chatLoading}
                  className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                />
                <button
                  onClick={() => sendChat(chatInput)}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
                >
                  {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <TilePanel
      tabs={RIGHT_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabVariant="icon"
      seeFullRoute={SEE_FULL_ROUTES[activeTab]}
      seeFullLabel="See Full"
      headerExtra={
        <span className="text-[10px] text-slate-600 shrink-0">
          {selectedLocation?.districtName || 'No location'}
        </span>
      }
    >
      {renderContent()}
    </TilePanel>
  );
}
