'use client';

import React from 'react';
import { TilePanel } from './TilePanel';
import { useDashboardData } from './DashboardDataContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMapLayerStore } from '@/lib/mapLayerStore';
import { Brain, Map, ClipboardList, Mail, Settings } from 'lucide-react';
import type { SegmentedTab } from './SegmentedControl';

const LEFT_TABS: SegmentedTab[] = [
  { id: 'ai-tools', label: 'AI Tools', icon: Brain },
  { id: 'map-layers', label: 'Map Layers', icon: Map },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
  { id: 'sms', label: 'SMS', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const SEE_FULL_ROUTES: Record<string, string> = {
  'ai-tools': '/flood-predict',
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
  const { showFloodZones, showWeatherStations, toggleFloodZones, toggleWeatherStations } = useMapLayerStore();
  const mlHealth = data.stats.mlHealth;

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-tools':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">AI Models</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors">
                <Brain size={14} />
                LSTM Predict
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium transition-colors">
                <span className="text-sm">👁</span>
                YOLO Verify
              </button>
            </div>
            <div className="pt-2 border-t border-white/5">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Model Status</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>LSTM</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${mlHealth.lstmReady ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                    {mlHealth.lstmReady ? 'Ready' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Vision</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${mlHealth.visionReady ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                    {mlHealth.visionReady ? 'Ready' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'map-layers':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Layers</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Flood Zones</span>
                <input type="checkbox" checked={showFloodZones} onChange={toggleFloodZones} className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Weather Stations</span>
                <input type="checkbox" checked={showWeatherStations} onChange={toggleWeatherStations} className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Evacuation Routes</span>
                <input type="checkbox" className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Sensors</span>
                <input type="checkbox" defaultChecked className="accent-blue-500" />
              </label>
            </div>
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors mt-3">
              📍 Set Location
            </button>
          </div>
        );
      case 'reports':
        return (
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Report</h3>
            <div className="space-y-2">
              <input
                placeholder="Location..."
                className="w-full bg-white/5 rounded px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 border border-white/5 focus:border-blue-500/50 outline-none"
              />
              <div className="flex gap-1">
                {['Ringan', 'Sedang', 'Parah'].map((sev) => (
                  <button
                    key={sev}
                    className="flex-1 text-[10px] py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
                  >
                    {sev}
                  </button>
                ))}
              </div>
              <button className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
                Submit Report
              </button>
            </div>
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
