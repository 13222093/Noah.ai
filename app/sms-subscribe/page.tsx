'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Phone,
    MapPin,
    Globe,
    User,
    CheckCircle2,
    AlertTriangle,
    ArrowLeft,
    Shield,
    Smartphone,
    Bell,
    Signal,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useLanguage } from '@/src/context/LanguageContext';

const REGIONS = [
    { id: 'MANGGARAI_01', name: 'Pintu Air Manggarai', desc: 'Pusat monitoring utama Jakarta' },
    { id: 'ISTIQLAL_01', name: 'Istiqlal', desc: 'Area Monas & sekitarnya' },
    { id: 'KARET_01', name: 'Pintu Air Karet', desc: 'Banjir Kanal Barat' },
    { id: 'ANCOL_01', name: 'Marina Ancol', desc: 'Pantai utara Jakarta' },
];

export default function SmsSubscribePage() {
    const [phone, setPhone] = useState('+62');
    const [name, setName] = useState('');
    const [region, setRegion] = useState('MANGGARAI_01');
    const [language, setLanguage] = useState<'id' | 'en'>('id');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const { t } = useLanguage();

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/sms-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: phone,
                    name: name || 'Warga',
                    region_id: region,
                    language,
                }),
            });

            const data = await res.json();

            if (!res.ok && res.status !== 200) {
                setError(data.error || 'Gagal mendaftar');
                return;
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Koneksi gagal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/20 backdrop-blur-md">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="text-cyan-400 hover:bg-cyan-400/10">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-cyan-400" />
                            {t('smsSubscribe.title')}
                        </h1>
                        <p className="text-sm text-slate-400">{t('smsSubscribe.subtitle')}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Why SMS — Info Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-800/30 backdrop-blur-sm">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-cyan-500/20 rounded-xl">
                                    <Signal className="h-8 w-8 text-cyan-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold text-white">{t('smsSubscribe.whySms')}</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        {t('smsSubscribe.whySmsDesc')}
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Badge variant="outline" className="border-cyan-700 text-cyan-300 text-xs">
                                            <Smartphone className="h-3 w-3 mr-1" /> {t('smsSubscribe.allPhones')}
                                        </Badge>
                                        <Badge variant="outline" className="border-cyan-700 text-cyan-300 text-xs">
                                            <Signal className="h-3 w-3 mr-1" /> {t('smsSubscribe.noInternet')}
                                        </Badge>
                                        <Badge variant="outline" className="border-cyan-700 text-cyan-300 text-xs">
                                            <Bell className="h-3 w-3 mr-1" /> {t('smsSubscribe.autoAi')}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Main Form / Success */}
                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="bg-emerald-950/40 border-emerald-700/30 backdrop-blur-sm">
                                <CardContent className="p-8 text-center space-y-4">
                                    <div className="inline-flex p-4 bg-emerald-500/20 rounded-full">
                                        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">{t('smsSubscribe.registered')}</h2>
                                    <p className="text-slate-300">
                                        Nomor <strong className="text-emerald-300">{phone}</strong> akan menerima
                                        peringatan banjir untuk wilayah <strong className="text-emerald-300">{REGIONS.find(r => r.id === region)?.name}</strong>.
                                    </p>
                                    <div className="bg-black/30 rounded-lg p-4 text-left text-sm text-slate-400 space-y-1">
                                        <p>📱 Anda akan menerima SMS saat level risiko <strong className="text-amber-300">WASPADA</strong>, <strong className="text-orange-300">BAHAYA</strong>, atau <strong className="text-red-300">KRITIS</strong>.</p>
                                        <p>🛑 Untuk berhenti berlangganan, balas <strong className="text-white">STOP</strong> ke SMS yang diterima.</p>
                                    </div>
                                    <div className="flex gap-3 justify-center pt-2">
                                        <Button
                                            onClick={() => { setSuccess(false); setPhone('+62'); setName(''); }}
                                            variant="outline"
                                            className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/30"
                                        >
                                            {t('smsSubscribe.registerAnother')}
                                        </Button>
                                        <Link href="/dashboard">
                                            <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                                                {t('smsSubscribe.backToDashboard')}
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <Card className="bg-slate-900/60 border-slate-700/30 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <Phone className="h-5 w-5 text-cyan-400" />
                                        {t('smsSubscribe.formTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-slate-400">
                                        {t('smsSubscribe.formDesc')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubscribe} className="space-y-6">
                                        {/* Phone Number */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-cyan-400" />
                                                {t('smsSubscribe.phoneNumber')}
                                            </label>
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="+628123456789"
                                                className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-lg tracking-wide"
                                                required
                                            />
                                            <p className="text-xs text-slate-500">Format internasional: +62 untuk Indonesia</p>
                                        </div>

                                        {/* Name */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                <User className="h-4 w-4 text-cyan-400" />
                                                {t('smsSubscribe.nameOptional')}
                                            </label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Nama Anda"
                                                className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                                            />
                                        </div>

                                        {/* Region Selection */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-cyan-400" />
                                                {t('smsSubscribe.monitoringRegion')}
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {REGIONS.map((r) => (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setRegion(r.id)}
                                                        className={`p-3 rounded-lg border text-left transition-all ${region === r.id
                                                            ? 'border-cyan-500 bg-cyan-950/40 ring-1 ring-cyan-500/30'
                                                            : 'border-slate-700 bg-slate-800/30 hover:border-slate-500'
                                                            }`}
                                                    >
                                                        <p className={`font-medium text-sm ${region === r.id ? 'text-cyan-300' : 'text-slate-300'}`}>
                                                            {r.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Language */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                <Globe className="h-4 w-4 text-cyan-400" />
                                                {t('smsSubscribe.smsLanguage')}
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setLanguage('id')}
                                                    className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${language === 'id'
                                                        ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-500/30'
                                                        : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    🇮🇩 Bahasa Indonesia
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLanguage('en')}
                                                    className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${language === 'en'
                                                        ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 ring-1 ring-cyan-500/30'
                                                        : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    🇬🇧 English
                                                </button>
                                            </div>
                                        </div>

                                        {/* SMS Preview */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-300">📱 {t('smsSubscribe.smsPreview')}</label>
                                            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-green-400 border border-slate-700/50">
                                                {language === 'id' ? (
                                                    <>
                                                        ⚠️ PERINGATAN BANJIR<br />
                                                        {REGIONS.find(r => r.id === region)?.name}: BAHAYA<br />
                                                        TMA: 720cm<br />
                                                        Segera evakuasi!<br />
                                                        Balas STOP utk berhenti
                                                    </>
                                                ) : (
                                                    <>
                                                        ⚠️ FLOOD ALERT<br />
                                                        {REGIONS.find(r => r.id === region)?.name}: DANGER<br />
                                                        Water: 720cm<br />
                                                        Evacuate now!<br />
                                                        Reply STOP to unsub
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Error */}
                                        {error && (
                                            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/30 rounded-lg">
                                                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                                <p className="text-sm text-red-300">{error}</p>
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <Button
                                            type="submit"
                                            disabled={loading || phone.length < 10}
                                            className="w-full py-6 text-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    {t('smsSubscribe.registering')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <Bell className="h-5 w-5" />
                                                    {t('smsSubscribe.submitButton')}
                                                </span>
                                            )}
                                        </Button>

                                        {/* Privacy Note */}
                                        <div className="flex items-start gap-2 text-xs text-slate-500">
                                            <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                            <p>
                                                {t('smsSubscribe.privacyNote')}
                                            </p>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* How It Works */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Card className="bg-slate-900/40 border-slate-700/20 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">{t('smsSubscribe.howItWorks')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="text-center space-y-3">
                                    <div className="inline-flex p-3 bg-cyan-500/10 rounded-xl">
                                        <Phone className="h-8 w-8 text-cyan-400" />
                                    </div>
                                    <h4 className="font-semibold text-white">{t('smsSubscribe.step1Title')}</h4>
                                    <p className="text-sm text-slate-400">{t('smsSubscribe.step1Desc')}</p>
                                </div>
                                <div className="text-center space-y-3">
                                    <div className="inline-flex p-3 bg-amber-500/10 rounded-xl">
                                        <Bell className="h-8 w-8 text-amber-400" />
                                    </div>
                                    <h4 className="font-semibold text-white">{t('smsSubscribe.step2Title')}</h4>
                                    <p className="text-sm text-slate-400">{t('smsSubscribe.step2Desc')}</p>
                                </div>
                                <div className="text-center space-y-3">
                                    <div className="inline-flex p-3 bg-emerald-500/10 rounded-xl">
                                        <MessageSquare className="h-8 w-8 text-emerald-400" />
                                    </div>
                                    <h4 className="font-semibold text-white">{t('smsSubscribe.step3Title')}</h4>
                                    <p className="text-sm text-slate-400">{t('smsSubscribe.step3Desc')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
