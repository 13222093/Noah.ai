'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudSun,
  Thermometer,
  Wind,
  Droplets,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn, getBaseUrl } from '@/lib/utils';
import { usePanel } from './PanelContext';
import { useAppStore } from '@/lib/store';
import { useTimestamp } from '@/hooks/useTimestamp';

interface WeatherSummary {
  location: string;
  current: {
    temperature: number;
    condition: string;
    icon: string;
  };
  forecast: Array<{
    time: string;
    temperature: number;
    condition: string;
  }>;
}

interface AirQualityData {
  aqi: number;
  level: string;
  pollutant: string;
  recommendation: string;
}

export function WeatherPanel() {
  const { resetPanel } = usePanel();
  const { selectedLocation } = useAppStore();
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weatherTimestamp = useTimestamp();

  const fetchWidgets = useCallback(async () => {
    if (!selectedLocation?.latitude || !selectedLocation?.longitude) {
      setWeather(null);
      setAirQuality(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${getBaseUrl()}/api/dashboard?lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}&locationName=${encodeURIComponent(selectedLocation.districtName || '')}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWeather(data.weatherSummary || null);
      setAirQuality(data.airQuality || null);
      weatherTimestamp.markUpdated();
    } catch (err: any) {
      console.error('Error fetching dashboard widgets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const getAqiColor = (aqi?: number) => {
    if (!aqi) return 'text-cc-text-muted';
    if (aqi <= 1) return 'text-cc-safe';
    if (aqi <= 2) return 'text-cc-caution';
    if (aqi <= 3) return 'text-cc-warning';
    return 'text-cc-critical';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cc-border">
        <button onClick={resetPanel} className="text-cc-text-muted hover:text-cc-text">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <CloudSun className="w-4 h-4 text-cc-cyan" />
        <h2 className="text-sm font-semibold text-cc-text font-heading">Weather & Air Quality</h2>
        {weatherTimestamp.timeAgo && <span className="ml-auto text-[10px] text-cc-text-muted font-mono">Updated {weatherTimestamp.timeAgo}</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-cc-cyan" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-3 bg-cc-critical/10 border border-cc-critical/20 rounded text-xs text-cc-critical">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
            Failed to load weather data
          </div>
        )}

        {/* No location selected */}
        {!selectedLocation?.latitude && !loading && (
          <div className="text-center py-8 text-cc-text-muted text-xs">
            Select a location to see weather data
          </div>
        )}

        {/* Weather Summary */}
        {weather && !loading && (
          <div className="p-3 bg-cc-elevated border border-cc-border rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-3.5 h-3.5 text-cc-warning" />
              <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
                Current Weather
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-mono font-bold text-cc-text">
                  {weather.current.temperature}°C
                </p>
                <p className="text-xs text-cc-text-secondary capitalize">
                  {weather.current.condition}
                </p>
                <p className="text-[10px] text-cc-text-muted mt-0.5">
                  {weather.location}
                </p>
              </div>
              {weather.current.icon && (
                <img
                  src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`}
                  alt={weather.current.condition}
                  className="w-12 h-12 opacity-80"
                />
              )}
            </div>

            {/* Mini forecast */}
            {weather.forecast?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-cc-border">
                <div className="grid grid-cols-3 gap-2">
                  {weather.forecast.map((f, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] text-cc-text-muted font-mono">{f.time}</p>
                      <p className="text-xs font-semibold text-cc-text">{f.temperature}°</p>
                      <p className="text-[9px] text-cc-text-muted truncate">{f.condition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Air Quality */}
        {airQuality && !loading && (
          <div className="p-3 bg-cc-elevated border border-cc-border rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-3.5 h-3.5 text-cc-safe" />
              <span className="text-[10px] font-semibold text-cc-text-secondary uppercase tracking-wider font-heading">
                Air Quality
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className={cn('text-lg font-mono font-bold', getAqiColor(airQuality.aqi))}>
                  AQI {airQuality.aqi}
                </p>
                <p className="text-xs text-cc-text-secondary">{airQuality.level}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-cc-text-muted">{airQuality.pollutant}</p>
              </div>
            </div>
            <p className="text-[10px] text-cc-text-muted leading-relaxed">
              {airQuality.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
