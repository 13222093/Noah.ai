'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Video, Play, Pause, RefreshCw, AlertTriangle } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';

export default function CCTVSimulationPage() {
  const [playing, setPlaying] = useState(false);
  const [channels] = useState([
    { id: 1, name: 'Channel 1', status: 'offline' },
    { id: 2, name: 'Channel 2', status: 'offline' },
    { id: 3, name: 'Channel 3', status: 'offline' },
    { id: 4, name: 'Channel 4', status: 'offline' },
  ]);

  return (
    <PageShell title="CCTV Monitoring" subtitle="Multi-channel YOLO flood detection" icon={<Video className="w-4 h-4" />}>
      <div className="max-w-6xl mx-auto">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {channels.map((ch) => (
          <Card key={ch.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{ch.name}</CardTitle>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    ch.status === 'online'
                      ? 'bg-emerald-500/20 text-emerald-600'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {ch.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-slate-900 dark:bg-slate-950 rounded-lg flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No video source</p>
                  <p className="text-xs mt-1">Placeholder for CCTV feed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={playing ? 'outline' : 'default'}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? (
                <Pause className="w-4 h-4 mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button variant="outline" onClick={() => {}}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              CCTV simulation requires video sources. Integrate with Floodnet sensor simulator or
              provide video URLs for live YOLO analysis.
            </span>
          </div>
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
