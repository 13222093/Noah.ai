'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Loader2, Upload, ImageIcon, AlertTriangle, CheckCircle, Camera } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useLanguage } from '@/src/context/LanguageContext';

interface VerifyResult {
  is_flooded?: boolean;
  flood_probability?: number;
  objects_detected?: string[];
  status?: string;
  message?: string;
}

export default function VisualVerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { t } = useLanguage();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith('image/')) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/verify-visual', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.detail || 'Verification failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <PageShell title={t('visualVerify.title')} subtitle={t('visualVerify.subtitle')} icon={<Camera className="w-4 h-4" />}>
      <div className="max-w-4xl mx-auto">

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('visualVerify.uploadImage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                  : 'border-slate-300 dark:border-slate-600 hover:border-cyan-400'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <ImageIcon className="w-12 h-12" />
                    <span>{t('visualVerify.dragDrop')}</span>
                  </div>
                )}
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleVerify} disabled={!file || loading} className="flex-1">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {loading ? t('visualVerify.analyzing') : t('visualVerify.verify')}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={!file}>
                {t('visualVerify.reset')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('visualVerify.detectionResult')}</CardTitle>
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
                <div className="flex items-center gap-2">
                  {result.is_flooded ? (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  )}
                  <span className="font-medium">
                    {result.is_flooded ? t('visualVerify.floodDetected') : t('visualVerify.noFlood')}
                  </span>
                </div>
                {result.flood_probability !== undefined && (
                  <div>
                    <span className="text-sm text-slate-500">{t('visualVerify.floodProbability')}</span>
                    <div className="mt-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all"
                        style={{ width: `${(result.flood_probability * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-500">
                      {(result.flood_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {result.objects_detected && result.objects_detected.length > 0 && (
                  <div>
                    <span className="text-sm text-slate-500">{t('visualVerify.objectsDetected')}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {result.objects_detected.map((obj) => (
                        <span
                          key={obj}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-sm"
                        >
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!result && !error && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t('visualVerify.emptyState')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </PageShell>
  );
}
