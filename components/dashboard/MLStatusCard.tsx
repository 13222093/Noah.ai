'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Brain, Camera, ArrowRight, Loader2 } from 'lucide-react';

export function MLStatusCard() {
  const [status, setStatus] = useState<{
    lstm_ready: boolean;
    vision_ready: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ml-health')
      .then((res) => res.json())
      .then((data) => {
        if (data.models) setStatus(data.models);
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="bg-white/80 dark:bg-slate-900/80 border-slate-200/50 dark:border-slate-800/50">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-slate-900/80 border-slate-200/50 dark:border-slate-800/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-500" />
          ML Services
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">LSTM Prediction</span>
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              status?.lstm_ready
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}
          >
            {status?.lstm_ready ? 'Ready' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Visual Verify (YOLO)</span>
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              status?.vision_ready
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
            }`}
          >
            {status?.vision_ready ? 'Ready' : 'Offline'}
          </span>
        </div>
        <Link href="/flood-predict">
          <Button variant="outline" size="sm" className="w-full mt-2">
            Flood Predict
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
