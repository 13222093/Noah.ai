'use client';

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { TilePanel } from './TilePanel';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useAirPollutionData } from '@/hooks/useAirPollutionData';
import { useAppStore } from '@/lib/store';
import { AlertTriangle, Activity, Cloud, Wind, BarChart3, Clock, Bot, Send, Loader2, Droplets, Search, Info, MapPin, TrendingUp, Navigation, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SegmentedTab } from './SegmentedControl';

const RIGHT_TABS: SegmentedTab[] = [
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'weather', label: 'Cuaca', icon: Cloud },
  { id: 'ai', label: 'AI Chat', icon: Bot },
];

const SEE_FULL_ROUTES: Record<string, string> = {
  alerts: '/alerts',
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
    { text: 'Status banjir wilayah saya', icon: MapPin, color: 'text-cyan-400' },
    { text: 'Prediksi cuaca hari ini', icon: Cloud, color: 'text-blue-400' },
    { text: 'Tingkat risiko banjir', icon: AlertTriangle, color: 'text-amber-400' },
    { text: 'Rekomendasi evakuasi', icon: Navigation, color: 'text-emerald-400' },
    { text: 'Analisis trend 5 hari', icon: TrendingUp, color: 'text-purple-400' },
    { text: 'Kondisi stasiun pompa', icon: Droplets, color: 'text-orange-400' },
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
          <div className="p-3 space-y-3 overflow-y-auto">
            {/* WEATHER SECTION */}
            {weatherLoading ? (
              <div className="text-center py-4 text-xs text-slate-500">Loading weather...</div>
            ) : weatherData?.current ? (() => {
              const iconCode = weatherData.current.weather?.[0]?.icon;
              const sunrise = weatherData.current.sys?.sunrise;
              const sunset = weatherData.current.sys?.sunset;
              const fmtTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              return (
                <>
                  {/* Hero: icon + temp */}
                  <div className="flex items-center justify-center gap-3 py-2">
                    {iconCode && (
                      <img
                        src={`https://openweathermap.org/img/wn/${iconCode}@2x.png`}
                        alt="weather"
                        className="w-16 h-16 -my-2 drop-shadow-lg"
                      />
                    )}
                    <div className="text-center">
                      <p className="text-3xl font-bold text-slate-100 tracking-tight">
                        {Math.round(weatherData.current.main?.temp ?? 0)}°C
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {weatherData.current.weather?.[0]?.description || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-slate-600 -mt-1">
                    Terasa seperti {Math.round(weatherData.current.main?.feels_like ?? 0)}°C
                  </p>

                  {/* Stats grid with icons */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                      <Droplets size={14} className="text-blue-400 shrink-0" />
                      <div>
                        <p className="text-slate-600 text-[9px]">Kelembaban</p>
                        <p className="text-slate-300 font-semibold">{weatherData.current.main?.humidity ?? '--'}%</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                      <Wind size={14} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-slate-600 text-[9px]">Angin</p>
                        <p className="text-slate-300 font-semibold">{((weatherData.current.wind?.speed ?? 0) * 3.6).toFixed(1)} km/h</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                      <Activity size={14} className="text-purple-400 shrink-0" />
                      <div>
                        <p className="text-slate-600 text-[9px]">Tekanan</p>
                        <p className="text-slate-300 font-semibold">{weatherData.current.main?.pressure ?? '--'} hPa</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                      <Search size={14} className="text-amber-400 shrink-0" />
                      <div>
                        <p className="text-slate-600 text-[9px]">Visibilitas</p>
                        <p className="text-slate-300 font-semibold">{((weatherData.current.visibility ?? 0) / 1000).toFixed(1)} km</p>
                      </div>
                    </div>
                  </div>

                  {/* Sunrise / Sunset */}
                  {sunrise && sunset && (
                    <div className="flex items-center justify-center gap-6 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">🌅 Terbit <span className="text-slate-300 font-medium">{fmtTime(sunrise)}</span></span>
                      <span className="flex items-center gap-1">🌇 Terbenam <span className="text-slate-300 font-medium">{fmtTime(sunset)}</span></span>
                    </div>
                  )}
                </>
              );
            })() : (
              <div className="text-center py-4">
                <Cloud size={32} className="mx-auto text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">Pilih lokasi untuk melihat cuaca</p>
              </div>
            )}

            {/* DIVIDER */}
            <div className="border-t border-white/5 my-1" />

            {/* AQI SECTION */}
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kualitas Udara (AQI)</h4>
            {aqiLoading ? (
              <div className="text-center py-3 text-xs text-slate-500">Loading AQI...</div>
            ) : aqiInfo ? (
              <>
                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                  <p className={`text-2xl font-bold ${aqiInfo.color}`}>{aqiValue}</p>
                  <div>
                    <p className={`text-xs font-medium ${aqiInfo.color}`}>{aqiInfo.label}</p>
                    <p className="text-[10px] text-slate-500">{aqiInfo.recommendation}</p>
                  </div>
                </div>
                {aqiComponents && (
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {[
                      { key: 'pm2_5', label: 'PM2.5' },
                      { key: 'pm10', label: 'PM10' },
                      { key: 'no2', label: 'NO₂' },
                      { key: 'o3', label: 'O₃' },
                      { key: 'so2', label: 'SO₂' },
                      { key: 'co', label: 'CO' },
                    ].map(({ key, label }) => (
                      <div key={key} className="bg-white/5 rounded p-1.5 text-center">
                        <p className="text-slate-600 text-[9px]">{label}</p>
                        <p className="text-slate-400 text-[11px]">
                          {(aqiComponents as any)[key]?.toFixed(1) ?? '--'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-2">
                <p className="text-2xl font-bold text-slate-600">--</p>
                <p className="text-xs text-slate-500">Pilih lokasi untuk melihat AQI</p>
              </div>
            )}

            {/* DIVIDER */}
            <div className="border-t border-white/5 my-1" />

            {/* 5-DAY FORECAST */}
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <BarChart3 size={10} className="text-emerald-400" /> Prakiraan 5 Hari
            </h4>
            {weatherData?.daily && weatherData.daily.length > 0 ? (
              <div className="space-y-1">
                {weatherData.daily.slice(0, 5).map((day: any, i: number) => {
                  const dt = new Date(day.dt * 1000);
                  const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' });
                  const desc = day.weather?.[0]?.description || '--';
                  const iconCode = day.weather?.[0]?.icon;
                  const hi = Math.round(day.main?.temp_max ?? day.main?.temp ?? 0);
                  const lo = Math.round(day.main?.temp_min ?? day.main?.temp ?? 0);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
                      <span className="text-xs font-semibold text-slate-300 w-8">{dayName}</span>
                      {iconCode ? (
                        <img
                          src={`https://openweathermap.org/img/wn/${iconCode}.png`}
                          alt={desc}
                          className="w-7 h-7 -my-1"
                        />
                      ) : (
                        <Cloud size={16} className="text-slate-500 w-7" />
                      )}
                      <span className="text-[10px] text-slate-400 flex-1 capitalize truncate">{desc}</span>
                      <span className="text-xs text-slate-300 font-medium whitespace-nowrap">
                        {hi}° / {lo}°
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-600">Pilih lokasi untuk melihat prakiraan</p>
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
                    {!msg.isUser && msg.id === 'welcome' ? (
                      /* Rich welcome message */
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Info size={12} className="text-cyan-400" />
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">SISTEM INFO</span>
                        </div>
                        <p className="text-[12px] font-medium text-slate-200">
                          👋 Selamat datang di Noah.ai Assistant!
                        </p>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-slate-300 font-medium">Saya dapat membantu Anda menganalisis:</p>
                          <ul className="space-y-0.5 pl-0.5">
                            <li className="text-[11px] text-slate-400">• Status banjir real-time</li>
                            <li className="text-[11px] text-slate-400">• Prediksi cuaca dan risiko</li>
                            <li className="text-[11px] text-slate-400">• Rekomendasi tindakan darurat</li>
                          </ul>
                        </div>
                      </div>
                    ) : !msg.isUser ? (
                      /* Normal bot reply */
                      <>
                        <div className="flex items-center gap-1 mb-1">
                          <Bot size={10} className="text-cyan-400" />
                          <span className="text-[9px] font-semibold text-cyan-400">noah.ai</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
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

            {/* Quick Action Cards (show only initially) */}
            {chatMessages.length <= 1 && (
              <div className="px-2 pb-2 space-y-1.5">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 px-1">
                  <Zap size={9} className="text-amber-400" /> AKSI CEPAT
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {chatSuggestions.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => sendChat(s.text)}
                      className="flex items-center gap-2 text-left bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/20 rounded-lg px-2.5 py-2 transition-all group"
                    >
                      <s.icon size={14} className={cn(s.color, 'shrink-0 opacity-70 group-hover:opacity-100 transition-opacity')} />
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors leading-tight">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input + Status */}
            <div className="shrink-0 border-t border-white/5 p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                  placeholder="Tanyakan tentang kondisi banjir, cuaca..."
                  disabled={chatLoading}
                  className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50"
                />
                <Activity size={14} className="text-slate-600 shrink-0" />
                <button
                  onClick={() => sendChat(chatInput)}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-colors"
                >
                  {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <p className="text-center text-[8px] text-slate-600 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Terhubung ke sistem Noah.ai
              </p>
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
