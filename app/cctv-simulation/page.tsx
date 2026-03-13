'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { CCTV_CHANNELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/src/context/LanguageContext';

export default function CCTVSimulationPage() {
  // Sort: flooded first → online → offline
  const sorted = [...CCTV_CHANNELS].sort((a, b) => {
    if (a.is_flooded !== b.is_flooded) return a.is_flooded ? -1 : 1;
    if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
    return 0;
  });

  const onlineCount = CCTV_CHANNELS.filter(c => c.status === 'online').length;
  const floodedCount = CCTV_CHANNELS.filter(c => c.is_flooded).length;
  const { t } = useLanguage();

  return (
    <PageShell
      title={t('cctvSimulation.title')}
      subtitle={t('cctvSimulation.subtitle')}
      icon={<Video className="w-4 h-4" />}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Summary bar */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-sm font-semibold text-red-400">{floodedCount} {t('cctvSimulation.floodDetected')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{onlineCount - floodedCount} {t('cctvSimulation.normal')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
            <WifiOff size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-400">{CCTV_CHANNELS.length - onlineCount} {t('cctvSimulation.offline')}</span>
          </div>
        </div>

        {/* Camera grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((ch) => {
            const scanTime = ch.lastScanOffsetMs > 0
              ? (() => {
                  const mins = Math.floor(ch.lastScanOffsetMs / 60000);
                  return mins < 1 ? t('cctvSimulation.justNow') : `${mins} ${t('cctvSimulation.minutesAgo')}`;
                })()
              : t('cctvSimulation.unavailable');

            return (
              <Card
                key={ch.id}
                className={cn(
                  'overflow-hidden',
                  ch.is_flooded && 'border-red-500/50 data-pulse',
                  ch.status === 'online' && !ch.is_flooded && 'border-emerald-500/30',
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{ch.name}</CardTitle>
                    <span
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full font-bold',
                        ch.is_flooded
                          ? 'bg-red-500/20 text-red-400'
                          : ch.status === 'online'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-500',
                      )}
                    >
                      {ch.is_flooded ? `🔴 ${t('cctvSimulation.floodBadge')}` : ch.status === 'online' ? `🟢 ${t('cctvSimulation.normalBadge')}` : `⚪ ${t('cctvSimulation.offlineBadge')}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ch.location}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Video feed */}
                  <div className="aspect-video bg-slate-900 dark:bg-slate-950 rounded-lg relative overflow-hidden">
                    {ch.videoSrc ? (
                      <video
                        src={ch.videoSrc}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-center text-slate-500">
                        <div>
                          <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">CCTV Feed — {ch.name}</p>
                          <p className="text-xs mt-1 text-slate-600">{ch.location}</p>
                        </div>
                      </div>
                    )}
                    {ch.is_flooded && (
                      <div className="absolute inset-0 border-2 border-red-500/60 rounded-lg pointer-events-none" />
                    )}
                  </div>

                  {/* Detection details */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('cctvSimulation.confidence')}</p>
                      <p className={cn(
                        'font-bold text-lg',
                        ch.flood_probability >= 0.7 ? 'text-red-400' :
                        ch.flood_probability >= 0.3 ? 'text-yellow-400' :
                        'text-emerald-400',
                      )}>
                        {ch.status === 'online' ? `${Math.round(ch.flood_probability * 100)}%` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('cctvSimulation.objectsDetected')}</p>
                      <p className="font-semibold">
                        {ch.objects_detected.length > 0 ? ch.objects_detected.join(', ') : t('cctvSimulation.none')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('cctvSimulation.lastScan')}</p>
                      <p className="font-semibold">{scanTime}</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  {ch.status === 'online' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t('cctvSimulation.floodProbability')}</span>
                        <span className={cn(
                          'font-bold',
                          ch.flood_probability >= 0.7 ? 'text-red-400' :
                          ch.flood_probability >= 0.3 ? 'text-yellow-400' :
                          'text-emerald-400',
                        )}>
                          {Math.round(ch.flood_probability * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            ch.flood_probability >= 0.7 ? 'bg-red-500' :
                            ch.flood_probability >= 0.3 ? 'bg-yellow-500' :
                            'bg-emerald-500',
                          )}
                          style={{ width: `${Math.round(ch.flood_probability * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info footer */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold text-foreground">{t('cctvSimulation.systemInfo')}</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  <li>• <strong>Model Deteksi:</strong> YOLOv8 untuk identifikasi area banjir</li>
                  <li>• <strong>Format:</strong> MP4 (resolusi optimal: 640×480 / 1280×720)</li>
                  <li>• <strong>Interval Scan:</strong> Otomatis setiap 3 detik</li>
                  <li>• <strong>Backend:</strong> FastAPI + Ultralytics via /verify-visual endpoint</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
