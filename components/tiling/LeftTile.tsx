'use client';

import React from 'react';
import { TilePanel } from './TilePanel';
import { FloodRiskForecast } from './FloodRiskForecast';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMapLayerStore } from '@/lib/mapLayerStore';
import { Brain, Map, ClipboardList, Mail, Settings } from 'lucide-react';
import type { SegmentedTab } from './SegmentedControl';

const LEFT_TABS: SegmentedTab[] = [
  { id: 'ai-tools', label: 'Forecast', icon: Brain },
  { id: 'map-layers', label: 'Map Layers', icon: Map },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
  { id: 'sms', label: 'SMS', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const SEE_FULL_ROUTES: Record<string, string> = {
  'reports': '/flood-report',
  'sms': '/sms-subscribe',
  'settings': '/settings',
};

interface LeftTileProps {
  collapsed?: boolean;
}

export function LeftTile({ collapsed = false }: LeftTileProps) {
  const [activeTab, setActiveTab] = useLocalStorage('noah-left-tab', 'ai-tools');
  const data = useDashboardData();
  const {
    showFloodZones, showWeatherStations, showRadar, showAqi, showEvacPins,
    toggleFloodZones, toggleWeatherStations, toggleRadar, toggleAqi, toggleEvacPins,
  } = useMapLayerStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-tools':
        return <FloodRiskForecast />;
      case 'map-layers':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Layers</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-1.5">🌧 Radar Overlay</span>
                <input type="checkbox" checked={showRadar} onChange={toggleRadar} className="accent-cyan-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-1.5">💨 AQI Bubbles</span>
                <input type="checkbox" checked={showAqi} onChange={toggleAqi} className="accent-emerald-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Flood Zones</span>
                <input type="checkbox" checked={showFloodZones} onChange={toggleFloodZones} className="accent-amber-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Weather Stations</span>
                <input type="checkbox" checked={showWeatherStations} onChange={toggleWeatherStations} className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-1.5">📍 Evacuation Pins</span>
                <input type="checkbox" checked={showEvacPins} onChange={toggleEvacPins} className="accent-red-500" />
              </label>
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="p-3 space-y-2.5 text-[11px]">
            {/* Current Time */}
            <div className="rounded-md bg-white/[0.03] border border-white/5 p-2.5">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">🕐 Waktu Saat Ini</p>
              <p className="text-cyan-400 font-bold text-sm tabular-nums">{new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">WIB - Zona Waktu Indonesia</p>
            </div>

            {/* Guidelines */}
            <div className="rounded-md bg-white/[0.03] border border-white/5 p-2.5">
              <p className="text-[10px] font-semibold text-slate-300 mb-1.5">Panduan Pelaporan</p>
              <ul className="space-y-1 text-[10px] text-slate-400">
                <li>• Pastikan lokasi yang dilaporkan akurat</li>
                <li>• Pilih tinggi air sesuai kondisi</li>
                <li>• Sertakan foto untuk validasi</li>
              </ul>
            </div>

            {/* Emergency Contacts */}
            <div className="rounded-md bg-amber-500/5 border border-amber-500/10 p-2.5">
              <p className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-1.5">⚠️ Kontak Darurat</p>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between"><span className="text-slate-500">BPBD:</span><span className="text-slate-300 font-medium">164</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Damkar:</span><span className="text-slate-300 font-medium">113</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Polri:</span><span className="text-slate-300 font-medium">110</span></div>
              </div>
            </div>

            {/* Redirect Button */}
            <a
              href="/flood-report"
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              <ClipboardList size={12} /> Buat Laporan Banjir
            </a>
          </div>
        );
      case 'sms':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">SMS Alerts</h3>
            <div className="rounded-md bg-white/5 p-2 text-xs text-slate-400">
              <p>Status: <span className="text-emerald-400">Active</span></p>
              <p className="mt-1 text-slate-500">Subscribed to flood alerts for selected region.</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Settings</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Language</span>
                <select className="bg-white/5 rounded px-1.5 py-1 text-xs text-slate-300 border border-white/5 outline-none">
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Notifications</span>
                <input type="checkbox" defaultChecked className="accent-blue-500" />
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TilePanel
        tabs={LEFT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabVariant="icon"
        seeFullRoute={SEE_FULL_ROUTES[activeTab]}
        seeFullLabel={`Open ${LEFT_TABS.find(t => t.id === activeTab)?.label}`}
        className="flex-1"
      >
        {renderContent()}
      </TilePanel>
    </div>
  );
}
