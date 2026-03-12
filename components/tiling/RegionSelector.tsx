'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown, Loader2, X, Crosshair, Globe, Building2, Navigation, Check } from 'lucide-react';
import { useRegionData } from '@/hooks/useRegionData';
import { useLocationStore } from '@/lib/locationStore';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * Region selector for TilingStatusBar.
 * Single trigger button → opens polished dropdown panel with:
 *   - GPS locate button
 *   - Cascading Provinsi → Kab/Kota → Kecamatan selects
 *   - Summary + confirm
 * Design follows the Deep Ocean AI aesthetic with proper spacing/typography.
 */

/* ---------- Sub-component: searchable list ---------- */
interface RegionListProps {
  label: string;
  icon: React.ReactNode;
  data: any[];
  valueKey: string;
  nameKey: string;
  value: string | null;
  loading: boolean;
  disabled: boolean;
  onSelect: (code: string, name: string, item: any) => void;
}

function RegionList({ label, icon, data, valueKey, nameKey, value, loading, disabled, onSelect }: RegionListProps) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? data.filter((d) => d[nameKey]?.toLowerCase().includes(filter.toLowerCase()))
    : data;

  const selectedName = value
    ? data.find((d) => String(d[valueKey]) === value)?.[nameKey]
    : null;

  return (
    <div className={cn('transition-opacity', disabled && 'opacity-40 pointer-events-none')}>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
        {icon}
        {label}
        {loading && <Loader2 size={9} className="animate-spin text-blue-400 ml-auto" />}
      </label>

      {/* Selected badge */}
      {selectedName && !loading && (
        <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
          <Check size={10} className="text-blue-400 flex-shrink-0" />
          <span className="text-[11px] text-blue-300 font-medium truncate">{selectedName}</span>
        </div>
      )}

      {/* Search */}
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Cari ${label.toLowerCase()}...`}
        disabled={disabled}
        className="w-full px-2.5 py-1.5 text-[11px] bg-white/5 border border-white/8 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 focus:bg-white/8 transition-colors mb-1"
      />

      {/* List */}
      <div className="max-h-[120px] overflow-y-auto rounded-md scrollbar-thin">
        {loading ? (
          <div className="py-4 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <Loader2 size={10} className="animate-spin" /> Memuat data wilayah...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-3 text-center text-[10px] text-slate-600">
            {data.length === 0 ? `Pilih level sebelumnya` : 'Tidak ditemukan'}
          </div>
        ) : (
          filtered.map((item: any) => {
            const code = String(item[valueKey]);
            const isSelected = code === value;
            return (
              <button
                key={code}
                onClick={() => onSelect(code, item[nameKey], item)}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 text-[11px] rounded-sm transition-colors flex items-center justify-between',
                  isSelected
                    ? 'bg-blue-500/15 text-blue-300 font-medium'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className="truncate">{item[nameKey]}</span>
                {isSelected && <Check size={10} className="text-blue-400 flex-shrink-0 ml-1" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
export function RegionSelector() {
  const {
    provinceCode, regencyCode, districtCode,
    provinceName, regencyName, districtName,
    latitude, longitude,
    setProvince, setRegency, setDistrict, reset,
  } = useLocationStore();

  const setSelectedLocation = useAppStore((s) => s.setSelectedLocation);

  // --- Bridge: push region selection into the app-wide selectedLocation ---
  // This makes weather, AQI, water level, and all other consumers react automatically.
  useEffect(() => {
    if (latitude != null && longitude != null && districtName) {
      setSelectedLocation({
        latitude,
        longitude,
        districtName,
        districtCode: districtCode ?? undefined,
        regencyCode: regencyCode ?? undefined,
        regencyName: regencyName ?? undefined,
        provinceCode: provinceCode ?? undefined,
        provinceName: provinceName ?? undefined,
      });
    } else if (!districtName && !latitude) {
      // Reset was called — clear app-wide location too
      setSelectedLocation(null);
    }
  }, [latitude, longitude, districtName, districtCode, regencyCode, regencyName, provinceCode, provinceName, setSelectedLocation]);

  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: provinces, loading: loadingProv } = useRegionData({ type: 'provinces' });
  const { data: regencies, loading: loadingReg } = useRegionData({
    type: 'regencies',
    parentCode: provinceCode,
    enabled: !!provinceCode,
  });
  const { data: districts, loading: loadingDist } = useRegionData({
    type: 'districts',
    parentCode: regencyCode,
    enabled: !!regencyCode,
  });

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // GPS locate
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        reset();
        let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=14&addressdetails=1`,
            { headers: { 'User-Agent': 'noahAI/1.0' } }
          );
          const data = await res.json();
          name = data?.address?.suburb || data?.address?.village || data?.address?.city_district || data?.display_name?.split(',')[0] || name;
        } catch { /* keep coordinate fallback */ }
        setDistrict('gps', name, latitude, longitude);
        setLocating(false);
        setOpen(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [reset, setDistrict]);

  // Build display label
  const hasLocation = districtName || (latitude != null && longitude != null);
  const displayLabel = districtName
    ? (regencyName ? `${districtName}, ${regencyName}` : districtName)
    : 'Pilih Lokasi';

  // Progress dots
  const steps = [!!provinceCode, !!regencyCode, !!districtCode];

  return (
    <div ref={panelRef} className="relative">
      {/* ---- Trigger Button ---- */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border h-[22px]',
          hasLocation
            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/15'
            : 'bg-white/5 text-slate-400 border-white/8 hover:bg-white/10 hover:text-slate-200',
        )}
      >
        <MapPin size={11} className={hasLocation ? 'text-blue-400' : 'text-slate-500'} />
        <span className="truncate max-w-[160px]">{displayLabel}</span>
        <ChevronDown size={9} className={cn('text-slate-500 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {/* ---- Dropdown Panel ---- */}
      {open && (
        <div
          className={cn(
            'absolute top-full right-0 mt-1.5 z-[9999]',
            'w-[300px] rounded-xl overflow-hidden',
            'bg-[hsl(210_30%_8%)] border border-white/8',
            'shadow-2xl shadow-black/40',
            'animate-in fade-in slide-in-from-top-1 duration-150',
          )}
        >
          {/* Header */}
          <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Navigation size={10} className="text-white" />
              </div>
              <div>
                <h3 className="text-[12px] font-semibold text-white leading-none">Pilih Wilayah</h3>
                <p className="text-[9px] text-slate-500 mt-0.5">Provinsi → Kab/Kota → Kecamatan</p>
              </div>
            </div>
            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {steps.map((done, i) => (
                <div key={i} className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  done ? 'bg-blue-400' : 'bg-white/10',
                )} />
              ))}
            </div>
          </div>

          {/* GPS Locate */}
          <div className="px-4 py-2 border-b border-white/5">
            <button
              onClick={handleLocateMe}
              disabled={locating}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all',
                'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/15',
                'text-blue-300 hover:from-blue-500/15 hover:to-cyan-500/15 hover:border-blue-500/25',
                locating && 'opacity-70 cursor-wait',
              )}
            >
              {locating ? (
                <Loader2 size={12} className="animate-spin text-blue-400" />
              ) : (
                <Crosshair size={12} className="text-blue-400" />
              )}
              <span>{locating ? 'Mencari lokasi Anda...' : 'Gunakan Lokasi Saat Ini'}</span>
            </button>
          </div>

          {/* Cascading Selects */}
          <div className="px-4 py-3 space-y-3 max-h-[360px] overflow-y-auto scrollbar-thin">
            <RegionList
              label="Provinsi"
              icon={<Globe size={9} />}
              data={provinces}
              valueKey="province_code"
              nameKey="province_name"
              value={provinceCode}
              loading={loadingProv}
              disabled={false}
              onSelect={(code, name) => setProvince(code, name)}
            />

            <RegionList
              label="Kabupaten / Kota"
              icon={<Building2 size={9} />}
              data={regencies}
              valueKey="city_code"
              nameKey="city_name"
              value={regencyCode}
              loading={loadingReg}
              disabled={!provinceCode}
              onSelect={(code, name) => setRegency(code, name)}
            />

            <RegionList
              label="Kecamatan"
              icon={<MapPin size={9} />}
              data={districts}
              valueKey="sub_district_code"
              nameKey="sub_district_name"
              value={districtCode}
              loading={loadingDist}
              disabled={!regencyCode}
              onSelect={(code, name, item) => {
                setDistrict(code, name, item.sub_district_latitude, item.sub_district_longitude);
                setOpen(false);
              }}
            />
          </div>

          {/* Footer */}
          {(provinceCode || districtName) && (
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
              <button
                onClick={() => { reset(); }}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <X size={9} /> Reset
              </button>
              {districtName && (
                <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                  <Check size={9} /> {districtName}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
