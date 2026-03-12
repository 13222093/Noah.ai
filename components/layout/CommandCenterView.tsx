'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useLanguage } from '@/src/context/LanguageContext';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useDisasterData } from '@/hooks/useDisasterData';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, WEATHER_STATIONS_GLOBAL_MOCK } from '@/lib/constants';
import { cn, formatPopulation, getBaseUrl } from '@/lib/utils';
import { useTimestamp } from '@/hooks/useTimestamp';
import dynamic from 'next/dynamic';
import type { WeatherStation } from '@/types';
import {
  AlertTriangle,
  Droplets,
  ArrowUp,
  ArrowDown,
  Minus,
  MapPin,
  MessageSquare,
  Send,
  X,
  Bot,
  User,
  Loader2,
  FileText,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { PeringatanBencanaCard } from '@/components/flood/PeringatanBencanaCard';
import { PanelSwitcher } from '@/components/panels/PanelSwitcher';
import { SidebarSummary } from '@/components/panels/SidebarSummary';
import { useStats } from '@/components/contexts/StatsContext';
import { LocationPickerModal } from '@/components/modals/LocationPickerModal';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import type { SelectedLocation } from '@/types/location';

const FloodMap = dynamic(
  () => import('@/components/map/FloodMap').then((mod) => mod.FloodMap),
  { ssr: false },
);

// ============================================================
// ALERT PANEL (Right Sidebar)
// ============================================================
function AlertPanel({ alerts, onReportClick, onSmsClick, timeAgo }: {
  alerts: any[];
  onReportClick?: () => void;
  onSmsClick?: () => void;
  timeAgo?: string;
}) {
  const { t } = useLanguage();

  // Situation summary — natural language from existing data
  const situationSummary = useMemo(() => {
    if (!alerts.length) return null;
    const critCount = alerts.filter((a: any) => a.level === 'Tinggi').length;
    const warnCount = alerts.filter((a: any) => a.level === 'Sedang').length;
    const topLocations = alerts.slice(0, 3).map((a: any) => a.namaWilayah || a.location || 'Unknown').join(', ');
    const parts: string[] = [];
    if (critCount > 0) parts.push(`${critCount} critical`);
    if (warnCount > 0) parts.push(`${warnCount} warning`);
    return {
      headline: parts.length ? parts.join(', ') : `${alerts.length} active`,
      locations: topLocations,
    };
  }, [alerts]);

  return (
    <div className="h-full flex flex-col">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cc-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-cc-warning" />
          <h2 className="text-sm font-semibold text-cc-text font-heading">Alert Feed</h2>
        </div>
        <Badge
          variant="danger"
          className="text-[10px] px-1.5 py-0.5 font-mono"
        >
          {alerts.length} active
        </Badge>
      </div>
      {timeAgo && (
        <div className="px-4 pb-1">
          <span className="text-[10px] text-cc-text-muted font-mono">Updated {timeAgo}</span>
        </div>
      )}

      {/* Situation Summary */}
      {situationSummary && (
        <div className="mx-3 mt-2 p-2 bg-cc-elevated/50 border border-cc-border rounded text-[11px]">
          <p className="text-cc-text font-medium">
            ⚡ {situationSummary.headline}
          </p>
          <p className="text-cc-text-muted text-[10px] mt-0.5 truncate">
            {situationSummary.locations}
          </p>
        </div>
      )}

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-cc-text-muted text-sm">
            No active alerts
          </div>
        ) : (
          alerts.slice(0, 20).map((alert: any) => (
            <Link href="/alerts" key={alert.id}>
              <div className={cn(
                'p-3 rounded-md border cursor-pointer transition-colors',
                alert.level === 'Tinggi'
                  ? 'border-cc-critical/30 bg-cc-critical/5 hover:bg-cc-critical/10'
                  : alert.level === 'Sedang'
                    ? 'border-cc-warning/30 bg-cc-warning/5 hover:bg-cc-warning/10'
                    : 'border-cc-border bg-cc-elevated hover:bg-cc-surface'
              )}>
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    alert.level === 'Tinggi' ? 'bg-cc-critical' :
                      alert.level === 'Sedang' ? 'bg-cc-warning' : 'bg-cc-safe'
                  )} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cc-text truncate">
                      {alert.location}
                    </p>
                    <p className="text-[11px] text-cc-text-muted mt-0.5 line-clamp-2">
                      {alert.reason}
                    </p>
                    {alert.estimatedPopulation && (
                      <p className="text-[10px] text-cc-text-muted mt-1 font-mono">
                        ~{formatPopulation(alert.estimatedPopulation)} affected
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}

        {/* View all link */}
        {alerts.length > 20 && (
          <div className="px-3 pb-2">
            <Link href="/alerts" className="text-[11px] text-cc-cyan hover:underline font-medium">
              View all {alerts.length} alerts →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-3 border-t border-cc-border space-y-2">
        <Link href="/flood-report">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs border-cc-border text-cc-text-secondary hover:text-cc-text hover:bg-cc-elevated"
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            Report Flood
          </Button>
        </Link>
        <Link href="/sms-subscribe">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs border-cc-border text-cc-text-secondary hover:text-cc-text hover:bg-cc-elevated mt-1"
          >
            <Phone className="w-3.5 h-3.5 mr-2" />
            SMS Subscribe
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// WATER LEVELS STRIP (Bottom of map)
// ============================================================
function WaterLevelsStrip({ waterLevelPosts }: { waterLevelPosts: any[] }) {
  // Show the top 8 most critical posts
  const sortedPosts = useMemo(() => {
    const statusOrder: Record<string, number> = { 'Bahaya': 0, 'Siaga': 1, 'Waspada': 2, 'Normal': 3 };
    return [...waterLevelPosts]
      .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
      .slice(0, 8);
  }, [waterLevelPosts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bahaya': return 'text-cc-critical';
      case 'Siaga': return 'text-cc-warning';
      case 'Waspada': return 'text-cc-caution';
      default: return 'text-cc-safe';
    }
  };

  // Bug #2 fix: Explicit bg class names so Tailwind JIT can see them (no runtime string manipulation)
  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Bahaya': return 'bg-cc-critical';
      case 'Siaga': return 'bg-cc-warning';
      case 'Waspada': return 'bg-cc-caution';
      default: return 'bg-cc-safe';
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'rising') return <ArrowUp className="w-3 h-3 text-cc-critical" />;
    if (trend === 'falling') return <ArrowDown className="w-3 h-3 text-cc-safe" />;
    return <Minus className="w-3 h-3 text-cc-text-muted" />;
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto border-t border-cc-border bg-cc-surface">
      <div className="flex items-center gap-1.5 mr-2 flex-shrink-0">
        <Droplets className="w-3.5 h-3.5 text-cc-cyan" />
        <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
          Water Levels
        </span>
      </div>
      {sortedPosts.map((post) => (
        <div
          key={post.id || post.name}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cc-elevated border border-cc-border rounded flex-shrink-0"
        >
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', getStatusBgColor(post.status))} />
          <span className="text-[11px] text-cc-text-secondary truncate max-w-[80px]">
            {post.name?.split(',')[0]}
          </span>
          <span className={cn('text-[11px] font-mono font-semibold', getStatusColor(post.status))}>
            {post.level || post.waterLevel}cm
          </span>
          {getTrendIcon(post.trend)}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// AI CHATBOT (Floating)
// ============================================================
function AIChatbot({ selectedLocation }: { selectedLocation: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lon: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bug #12 fix: Auto-detect geolocation when no location is selected
  useEffect(() => {
    if (!selectedLocation?.latitude && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          // Geolocation denied or unavailable — silently ignore
          setGeoLocation(null);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Resolve the best location to pass to the chatbot API
  const chatLocation = selectedLocation?.latitude
    ? selectedLocation
    : geoLocation
      ? { latitude: geoLocation.lat, longitude: geoLocation.lon, districtName: 'Current Location' }
      : null;

  const sendMessage = async () => {
    if (!input.trim()) return;
    const message = input;
    setInput('');
    setIsLoading(true);

    const newHistory = [...history, { role: 'user', parts: [{ text: message }] }];
    setHistory(newHistory);

    try {
      const res = await fetch(`${getBaseUrl()}/api/chatbot`, {
        method: 'POST',
        body: JSON.stringify({
          question: message,
          history: newHistory,
          location: chatLocation,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        setHistory(prev => [...prev, { role: 'model', parts: [{ text: data.answer }] }]);
      }
    } catch {
      setHistory(prev => [...prev, { role: 'model', parts: [{ text: 'Error connecting. Try again.' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-cc-cyan text-cc-bg flex items-center justify-center shadow-lg hover:scale-105 transition-transform md:bottom-4"
        title="AI Assistant"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 h-[calc(100vh-10rem)] max-h-96 bg-cc-surface border border-cc-border rounded-lg shadow-xl flex flex-col overflow-hidden md:bottom-4 md:h-96 md:max-h-96">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cc-border">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cc-cyan" />
          <span className="text-sm font-semibold text-cc-text font-heading">Noah AI</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-cc-text-muted hover:text-cc-text">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {history.length === 0 && (
          <div className="text-center text-cc-text-muted text-xs py-8">
            Ask anything about flood conditions...
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role !== 'user' && <Bot className="w-4 h-4 text-cc-cyan mt-0.5 flex-shrink-0" />}
            <div className={cn(
              'px-3 py-2 rounded-lg text-xs max-w-[85%]',
              msg.role === 'user'
                ? 'bg-cc-cyan/20 text-cc-text'
                : 'bg-cc-elevated text-cc-text-secondary'
            )}>
              {msg.parts?.[0]?.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-cc-cyan" />
            <Loader2 className="w-3 h-3 animate-spin text-cc-text-muted" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-cc-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask Noah AI..."
            className="flex-1 px-3 py-1.5 text-xs bg-cc-elevated border border-cc-border rounded text-cc-text placeholder:text-cc-text-muted focus:outline-none focus:border-cc-cyan/50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-1.5 text-cc-cyan hover:text-cc-cyan-hover disabled:text-cc-text-muted"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMMAND CENTER VIEW
// ============================================================
export function CommandCenterView({ initialData }: { initialData: any }) {
  const { selectedLocation, mapBounds, setSelectedLocation, setMapBounds } = useAppStore();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const alertsTimestamp = useTimestamp();
  const dataTimestamp = useTimestamp();
  const {
    weatherData,
    isLoading: isLoadingWeather,
    fetchWeather,
  } = useWeatherData();
  const {
    disasterProneAreas,
    isLoading: isLoadingDisaster,
    error: disasterError,

  } = useDisasterData();

  // Bug #6 fix: Fullscreen map — escape key listener + body overflow
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) setIsMapFullscreen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isMapFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isMapFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMapFullscreen]);

  // Fetch weather for default location on mount
  useEffect(() => {
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      fetchWeather(selectedLocation.latitude, selectedLocation.longitude);
    }
  }, [selectedLocation, fetchWeather]);

  // Bug #3 fix: Push stats to context so StatusBar can consume them
  const { setStats } = useStats();
  useEffect(() => {
    if (initialData.stats) {
      setStats(initialData.stats);
    }
  }, [initialData.stats, setStats]);

  // Mark data as loaded on mount
  useEffect(() => {
    if (initialData.realTimeAlerts?.length || initialData.waterLevelPosts?.length) {
      alertsTimestamp.markUpdated();
      dataTimestamp.markUpdated();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapBoundsChange = useCallback(
    (bounds: any) => setMapBounds(bounds),
    [setMapBounds],
  );

  // ========================
  // MOBILE LAYOUT
  // ========================
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Map (40vh) — with fullscreen drawer */}
        <div className="h-[40vh] relative flex-shrink-0">
          <FloodMap
            instanceId="cc-mobile"
            center={mapBounds?.center || DEFAULT_MAP_CENTER}
            zoom={mapBounds?.zoom || DEFAULT_MAP_ZOOM}
            className="h-full w-full"
            floodProneData={disasterProneAreas}
            loadingFloodData={isLoadingDisaster}
            floodDataError={disasterError}
            onMapBoundsChange={handleMapBoundsChange}
            selectedLocation={selectedLocation}
            globalWeatherStations={WEATHER_STATIONS_GLOBAL_MOCK as WeatherStation[]}
            isFullscreen={isMapFullscreen}
            onFullscreenToggle={() => setIsMapFullscreen(prev => !prev)}
          />

          {/* Location picker overlay */}
          <div className="absolute top-2 left-2 z-[1000]">
            <button
              onClick={() => setIsLocationPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cc-surface/90 backdrop-blur border border-cc-border rounded-md text-xs text-cc-text hover:bg-cc-elevated transition-colors shadow-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-cc-cyan" />
              {selectedLocation?.districtName || 'Select Location'}
            </button>
          </div>
        </div>

        {/* Mobile fullscreen drawer */}
        <Drawer open={isMapFullscreen} onOpenChange={setIsMapFullscreen}>
          <DrawerContent className="h-[100dvh] bg-cc-bg border-none">
            <DrawerHeader className="absolute top-0 left-0 right-0 z-50 bg-cc-bg/80 backdrop-blur-sm border-b border-cc-border px-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <DrawerTitle className="text-cc-text text-sm font-semibold">
                    Flood Monitoring
                  </DrawerTitle>
                  <DrawerDescription className="text-cc-text-muted text-xs">
                    {selectedLocation?.districtName || 'Jakarta'}
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <button className="text-cc-text-muted hover:text-cc-text">
                    <X className="w-5 h-5" />
                  </button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="flex-1 w-full h-full pt-[56px]" data-vaul-no-drag="true">
              <FloodMap
                instanceId="cc-mobile-fs"
                center={mapBounds?.center || DEFAULT_MAP_CENTER}
                zoom={mapBounds?.zoom || DEFAULT_MAP_ZOOM}
                className="h-full w-full"
                floodProneData={disasterProneAreas}
                loadingFloodData={isLoadingDisaster}
                floodDataError={disasterError}
                onMapBoundsChange={handleMapBoundsChange}
                selectedLocation={selectedLocation}
                globalWeatherStations={WEATHER_STATIONS_GLOBAL_MOCK as WeatherStation[]}
                isFullscreen={true}
                onFullscreenToggle={() => setIsMapFullscreen(false)}
              />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Water Levels Strip */}
        <WaterLevelsStrip waterLevelPosts={initialData.waterLevelPosts} />

        {/* Alert Feed (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          <AlertPanel alerts={initialData.realTimeAlerts || []} timeAgo={alertsTimestamp.timeAgo} />
        </div>

        {/* Chatbot */}
        <AIChatbot selectedLocation={selectedLocation} />

        {/* Location Picker Modal */}
        <LocationPickerModal
          isOpen={isLocationPickerOpen}
          onClose={() => setIsLocationPickerOpen(false)}
          onSave={(loc: SelectedLocation) => {
            setSelectedLocation(loc);
            if (loc.latitude && loc.longitude) {
              fetchWeather(loc.latitude, loc.longitude);
              const buffer = 0.05;
              setMapBounds({
                center: [loc.latitude, loc.longitude],
                zoom: 12,
                bounds: [
                  [loc.latitude - buffer, loc.longitude - buffer],
                  [loc.latitude + buffer, loc.longitude + buffer],
                ],
              });
            }
          }}
          initialLocation={selectedLocation}
        />
      </div>
    );
  }

  // ========================
  // DESKTOP LAYOUT
  // ========================
  return (
    <div className="flex h-full">
      {/* Map + Water Levels (main area) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Map (fills available space) */}
        <div className="flex-1 relative">
          <FloodMap
            instanceId="cc-desktop"
            center={mapBounds?.center || DEFAULT_MAP_CENTER}
            zoom={mapBounds?.zoom || DEFAULT_MAP_ZOOM}
            className="h-full w-full"
            floodProneData={disasterProneAreas}
            loadingFloodData={isLoadingDisaster}
            floodDataError={disasterError}
            onMapBoundsChange={handleMapBoundsChange}
            selectedLocation={selectedLocation}
            globalWeatherStations={WEATHER_STATIONS_GLOBAL_MOCK as WeatherStation[]}
            isFullscreen={isMapFullscreen}
            onFullscreenToggle={() => setIsMapFullscreen(prev => !prev)}
          />

          {/* Location picker overlay — top-left */}
          <div className="absolute top-2 left-2 z-[1000]">
            <button
              onClick={() => setIsLocationPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cc-surface/90 backdrop-blur border border-cc-border rounded-md text-xs text-cc-text hover:bg-cc-elevated transition-colors shadow-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-cc-cyan" />
              {selectedLocation?.districtName || 'Select Location'}
            </button>
          </div>
        </div>

        {/* Water Levels Strip (bottom) */}
        <WaterLevelsStrip waterLevelPosts={initialData.waterLevelPosts} />
      </div>

      {/* Right Sidebar Panel (280px) — swappable via NavRail */}
      <div className="w-[280px] flex-shrink-0 border-l border-cc-border bg-cc-surface flex flex-col">
        {/* Always-visible summary */}
        <SidebarSummary
          weatherData={weatherData?.current?.main ? {
            temperature: weatherData.current.main.temp,
            condition: weatherData.current.weather?.[0]?.description,
            icon: weatherData.current.weather?.[0]?.icon,
          } : null}
          topWaterPost={(() => {
            const posts = initialData.waterLevelPosts || [];
            if (!posts.length) return null;
            const top = posts.reduce((a: any, b: any) =>
              (a.level || a.waterLevel || 0) > (b.level || b.waterLevel || 0) ? a : b
            );
            return { name: top.name, level: top.level || top.waterLevel, status: top.status, trend: top.trend };
          })()}
          mlHealth={initialData.stats?.mlHealth || null}
        />
        {/* Swappable panel */}
        <div className="flex-1 overflow-hidden">
          <PanelSwitcher
            alerts={initialData.realTimeAlerts || []}
            timeAgo={alertsTimestamp.timeAgo}
            waterLevelPosts={initialData.waterLevelPosts || []}
            pumpStatusData={initialData.pumpStatusData || []}
            AlertPanelComponent={AlertPanel}
          />
        </div>
      </div>

      {/* Chatbot */}
      <AIChatbot selectedLocation={selectedLocation} />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationPickerOpen}
        onClose={() => setIsLocationPickerOpen(false)}
        onSave={(loc: SelectedLocation) => {
          setSelectedLocation(loc);
          if (loc.latitude && loc.longitude) {
            fetchWeather(loc.latitude, loc.longitude);
            const buffer = 0.05;
            setMapBounds({
              center: [loc.latitude, loc.longitude],
              zoom: 12,
              bounds: [
                [loc.latitude - buffer, loc.longitude - buffer],
                [loc.latitude + buffer, loc.longitude + buffer],
              ],
            });
          }
        }}
        initialLocation={selectedLocation}
      />
    </div>
  );
}
