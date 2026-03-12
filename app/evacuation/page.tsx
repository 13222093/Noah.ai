'use client';

import React, { useState, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Users,
  Home,
  Phone,
  ExternalLink,
  Info,
  CheckCircle,
  XCircle,
  Navigation,
  Shield,
  Clock,
  AlertTriangle,
  Droplets,
  Zap,
  HeartPulse,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { EvacuationLocation } from '@/types';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useMap } from 'react-leaflet';

const MapContainer = dynamic<any>(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic<any>(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic<any>(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic<any>(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });

const DEFAULT_MAP_CENTER: [number, number] = [-6.2088, 106.8456];
const DEFAULT_MAP_ZOOM = 10;

/** Helper component to fly the Leaflet map when selectedLocation changes */
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export default function InfoEvakuasiPage() {
  const { t, lang } = useLanguage();
  const [evacuationLocations, setEvacuationLocations] = useState<EvacuationLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<EvacuationLocation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [L, setL] = useState<any>(null);
  const [evacuationIcon, setEvacuationIcon] = useState<any>(null);

  // Read app-wide selected location from region selector
  const appLocation = useAppStore((s) => s.selectedLocation);
  const mapCenter: [number, number] = (appLocation?.latitude && appLocation?.longitude)
    ? [appLocation.latitude, appLocation.longitude]
    : DEFAULT_MAP_CENTER;
  const mapZoom = appLocation?.latitude ? 13 : DEFAULT_MAP_ZOOM;

  useEffect(() => {
    import('leaflet').then(leaflet => {
      const L = (leaflet.default || leaflet) as any;
      setL(L);
      setEvacuationIcon(
        new L.Icon({
          iconUrl: '/assets/evacuation_marker.svg',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        }),
      );
    });

    const fetchEvacuationLocations = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/evacuation');
        if (!response.ok) throw new Error(`Gagal mengambil data: ${response.statusText}`);
        const data: EvacuationLocation[] = await response.json();
        setEvacuationLocations(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvacuationLocations();
  }, []);

  const handleLocationClick = (location: EvacuationLocation) => {
    setSelectedLocation(location);
    setIsDialogOpen(true);
  };

  const openGoogleMaps = (lat: number, lon: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
  };

  const getCapacityColor = (loc: EvacuationLocation) => {
    const pct = (loc.capacity_current / loc.capacity_total) * 100;
    if (pct >= 90) return 'text-red-400';
    if (pct >= 70) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStatusBadge = (loc: EvacuationLocation) => {
    const pct = (loc.capacity_current / loc.capacity_total) * 100;
    if (pct >= 100) return { text: t('evacuationInfo.status.full'), cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (pct >= 70) return { text: t('evacuationInfo.status.almostFull'), cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    return { text: t('evacuationInfo.status.available'), cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  };

  const getOpsStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('buka') || s.includes('open')) return { text: 'Buka', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle size={10} /> };
    if (s.includes('penuh') || s.includes('full')) return { text: 'Penuh', cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle size={10} /> };
    if (s.includes('tutup') || s.includes('closed')) return { text: 'Tutup', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: <AlertTriangle size={10} /> };
    return { text: 'N/A', cls: 'bg-white/5 text-slate-400', icon: <Info size={10} /> };
  };

  const getServiceIcon = (key: string, status: string) => {
    const ok = status.toLowerCase().includes('tersedia') || status.toLowerCase().includes('available');
    const color = ok ? 'text-emerald-400' : 'text-red-400';
    switch (key) {
      case 'clean_water': return <Droplets className={`w-3.5 h-3.5 ${color}`} />;
      case 'electricity': return <Zap className={`w-3.5 h-3.5 ${color}`} />;
      case 'medical_support': return <HeartPulse className={`w-3.5 h-3.5 ${color}`} />;
      default: return <Info className={`w-3.5 h-3.5 text-slate-400`} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cc-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t('evacuationInfo.loading.title')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cc-bg flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center max-w-sm">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-slate-300 mb-1">{t('evacuationInfo.error.title')}</p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const availableSlots = evacuationLocations.reduce((acc, loc) => acc + (loc.capacity_total - loc.capacity_current), 0);
  const almostFullCount = evacuationLocations.filter(loc => (loc.capacity_current / loc.capacity_total) >= 0.7).length;

  return (
    <div className="min-h-screen bg-cc-bg text-cc-text">
      {/* Header — matches /alerts */}
      <div className="px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard?layout=tiling" className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="font-heading">Kembali</span>
        </Link>
        <span className="text-white/10">|</span>
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-cyan-400" />
          <h1 className="text-sm font-bold text-slate-200 font-heading">{t('evacuationInfo.title')}</h1>
          <span className="text-[11px] text-slate-500 hidden sm:inline">— Peta dan daftar lokasi evakuasi</span>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Stat cards — compact, 4 columns */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Lokasi', value: evacuationLocations.length, color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Home },
            { label: 'Slot Tersedia', value: availableSlots, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Users },
            { label: 'Hampir Penuh', value: almostFullCount, color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
            { label: 'Status', value: 'Live', color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Clock },
          ].map((stat) => (
            <div key={stat.label} className={cn('rounded-lg border border-white/5 p-3', stat.bg)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500">{stat.label}</span>
                <stat.icon size={12} className={stat.color} />
              </div>
              <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Map + List grid */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Map — 2/3 width */}
          <div className="lg:col-span-2 rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <MapPin size={12} className="text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">{t('evacuationInfo.map.title')}</span>
            </div>
            <div className="h-[480px]" style={{ position: 'relative', zIndex: 1 }}>
              {L && evacuationIcon && (
                <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} className="h-full w-full">
                  <ChangeView center={mapCenter} zoom={mapZoom} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  {evacuationLocations.map((loc) => (
                    <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={evacuationIcon} eventHandlers={{ click: () => handleLocationClick(loc) }}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{loc.name}</p>
                          <button onClick={() => handleLocationClick(loc)} className="text-cyan-500 hover:underline mt-1">Detail</button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </div>

          {/* List — 1/3 width */}
          <div className="rounded-lg border border-white/5 bg-white/[0.02] flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <Home size={12} className="text-blue-400" />
              <span className="text-xs font-semibold text-slate-300">{t('evacuationInfo.list.title')}</span>
              <span className="text-[9px] text-slate-600 ml-auto">{evacuationLocations.length} lokasi</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: '480px', scrollbarWidth: 'thin' }}>
              {evacuationLocations.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-xs">{t('evacuationInfo.list.noData')}</p>
              ) : (
                evacuationLocations.map((loc) => {
                  const badge = getStatusBadge(loc);
                  return (
                    <div
                      key={loc.id}
                      onClick={() => handleLocationClick(loc)}
                      className="rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-2.5 cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-[11px] font-semibold text-slate-200 leading-snug">{loc.name}</h4>
                        <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full border shrink-0 ml-2', badge.cls)}>{badge.text}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={9} className="text-slate-600 shrink-0" />
                        <p className="text-[9px] text-slate-500 line-clamp-1">{loc.address}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Users size={9} className="text-slate-600" />
                          <span className={cn('text-[10px] font-medium', getCapacityColor(loc))}>{loc.capacity_current}/{loc.capacity_total}</span>
                        </div>
                        <Navigation size={9} className="text-slate-600" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal — dark design */}
      <AnimatePresence>
        {isDialogOpen && selectedLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setIsDialogOpen(false)}
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
                    <h2 className="text-sm font-bold text-slate-200">{selectedLocation.name}</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">{selectedLocation.address}</p>
                  </div>
                  <button onClick={() => setIsDialogOpen(false)} className="text-slate-600 hover:text-slate-300 transition-colors">
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
                    {selectedLocation.operational_status && (() => {
                      const ops = getOpsStatus(selectedLocation.operational_status);
                      return (
                        <span className={cn('text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1', ops.cls)}>
                          {ops.icon} {ops.text}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-blue-400" />
                      <span className="text-[11px] text-slate-300 font-medium">Kapasitas</span>
                    </div>
                    <span className={cn('text-[9px] px-2 py-0.5 rounded-full border', getStatusBadge(selectedLocation).cls)}>
                      {getStatusBadge(selectedLocation).text}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Terisi:</span>
                    <span className="text-slate-300 font-medium">{selectedLocation.capacity_current} / {selectedLocation.capacity_total}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min((selectedLocation.capacity_current / selectedLocation.capacity_total) * 100, 100)}%` }} />
                  </div>
                </div>

                {/* Essential services */}
                {selectedLocation.essential_services && (
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <h4 className="text-[11px] text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                      <Info size={12} className="text-emerald-400" /> Layanan Tersedia
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(selectedLocation.essential_services).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded px-2 py-1.5">
                          {getServiceIcon(key, value as string)}
                          <span className="text-[9px] text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facilities */}
                {selectedLocation.facilities && selectedLocation.facilities.length > 0 && (
                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                    <h4 className="text-[11px] text-slate-300 font-medium mb-2 flex items-center gap-1.5">
                      <CheckCircle size={12} className="text-blue-400" /> Fasilitas
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedLocation.facilities.map((f, i) => (
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
                  {selectedLocation.contact_person && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Penanggung jawab:</span>
                      <span className="text-slate-300">{selectedLocation.contact_person}</span>
                    </div>
                  )}
                  {selectedLocation.contact_phone && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">Telepon:</span>
                      <a href={`tel:${selectedLocation.contact_phone}`} className="text-cyan-400 hover:text-cyan-300">{selectedLocation.contact_phone}</a>
                    </div>
                  )}
                  {selectedLocation.last_updated && (
                    <div className="flex items-center justify-between text-[9px] pt-1 border-t border-white/5">
                      <span className="text-slate-600">Update terakhir:</span>
                      <span className="text-slate-500">{new Date(selectedLocation.last_updated).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                {/* Navigate button */}
                <button
                  onClick={() => openGoogleMaps(selectedLocation.latitude, selectedLocation.longitude)}
                  className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-xs font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink size={12} />
                  Navigasi ke Lokasi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}