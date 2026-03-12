'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';
import { useLanguage } from '@/src/context/LanguageContext';

export default function DataSensorHeader() {
    const { t } = useLanguage();

    return (
        <div className="flex items-center gap-3">
            <Link href="/dashboard?layout=tiling" className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
            </Link>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" />
                <h1 className="text-sm font-bold text-slate-200">{t('sensorData.title')}</h1>
            </div>
        </div>
    );
}
