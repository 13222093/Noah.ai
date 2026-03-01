'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CloudRain, Droplets, Activity, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/src/context/LanguageContext';

interface Scenario {
  id: string;
  name: string;
  description: string;
  data: {
    rainfall_bogor: number;
    rainfall_jakarta: number;
    tma_manggarai: number;
  };
}

interface PredictionResult {
  status: string;
  prediction_cm: number;
  risk_level: string;
  alert_message: string;
  scenario_used?: string;
}

const RISK_COLORS: Record<string, string> = {
  AMAN: 'bg-emerald-500',
  WASPADA: 'bg-amber-500',
  BAHAYA: 'bg-orange-500',
  CRITICAL: 'bg-red-600',
  UNKNOWN: 'bg-slate-400',
};

export default function FloodPredictPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'manual' | 'scenario'>('manual');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [rainfallBogor, setRainfallBogor] = useState<string>('0');
  const [rainfallJakarta, setRainfallJakarta] = useState<string>('0');
  const [waterLevel, setWaterLevel] = useState<string>('300');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mlHealth, setMlHealth] = useState<{ lstm_ready: boolean; vision_ready: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setScenarios(data);
          if (data.length > 0) setSelectedScenarioId(data[0].id);
        }
      })
      .catch(() => setScenarios([]));
  }, []);

  useEffect(() => {
    fetch('/api/ml-health')
      .then((res) => res.json())
      .then((data) => {
        if (data.models) setMlHealth(data.models);
      })
      .catch(() => setMlHealth(null));
  }, []);

  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id);
    const s = scenarios.find((sc) => sc.id === id);
    if (s) {
      setRainfallBogor(String(s.data.rainfall_bogor));
      setRainfallJakarta(String(s.data.rainfall_jakarta));
      setWaterLevel(String(s.data.tma_manggarai));
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (mode === 'scenario' && selectedScenarioId) {
        const res = await fetch(`/api/scenarios/${selectedScenarioId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Prediction failed');
        setResult(data);
      } else {
        const payload = {
          water_level_cm: parseFloat(waterLevel) || 300,
          rainfall_mm: parseFloat(rainfallJakarta) || 0,
          rainfall_jakarta: parseFloat(rainfallJakarta) || 0,
          rainfall_bogor: parseFloat(rainfallBogor) || 0,
        };
        const res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Prediction failed');
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = result?.risk_level || 'UNKNOWN';
  const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.UNKNOWN;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Flood Prediction (LSTM)
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Predict water level based on rainfall data from Bogor and Jakarta
        </p>
      </div>

      {mlHealth && (
        <div className="flex gap-2 mb-6">
          <span
            className={`text-xs px-2 py-1 rounded ${
              mlHealth.lstm_ready ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
            }`}
          >
            LSTM: {mlHealth.lstm_ready ? 'Ready' : 'Offline'}
          </span>
          <span
            className={`text-xs px-2 py-1 rounded ${
              mlHealth.vision_ready ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
            }`}
          >
            YOLO: {mlHealth.vision_ready ? 'Ready' : 'Offline'}
          </span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input Data</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="flex gap-4 mb-4">
                <Button
                  variant={mode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('manual')}
                >
                  Manual
                </Button>
                <Button
                  variant={mode === 'scenario' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('scenario')}
                >
                  Demo Scenario
                </Button>
              </div>

              {mode === 'scenario' ? (
                <div className="space-y-4">
                  <div>
                    <Label>Scenario</Label>
                    <Select value={selectedScenarioId} onValueChange={handleScenarioChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scenario" />
                      </SelectTrigger>
                      <SelectContent>
                        {scenarios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {scenarios.find((s) => s.id === selectedScenarioId) && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      {scenarios.find((s) => s.id === selectedScenarioId)?.description}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4" /> Rainfall Bogor (mm)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={rainfallBogor}
                      onChange={(e) => setRainfallBogor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4" /> Rainfall Jakarta (mm)
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={rainfallJakarta}
                      onChange={(e) => setRainfallJakarta(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Droplets className="w-4 h-4" /> Current Water Level (cm)
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      value={waterLevel}
                      onChange={(e) => setWaterLevel(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full mt-4"
                onClick={handlePredict}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Activity className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Predicting...' : 'Get Prediction'}
              </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prediction Result</CardTitle>
          </CardHeader>
          <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Predicted Water Level</span>
                    <span className="text-xl font-bold">{result.prediction_cm} cm</span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Risk Level</span>
                    <div
                      className={`mt-1 rounded-lg px-3 py-2 text-white font-medium ${riskColor}`}
                    >
                      {result.risk_level}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Recommendation</span>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {result.alert_message}
                    </p>
                  </div>
                </div>
              )}

              {!result && !error && !loading && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Enter data and click &quot;Get Prediction&quot; to see results.
                </p>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
