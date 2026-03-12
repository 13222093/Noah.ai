'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  MapPin,
  Camera,
  Send,
  AlertTriangle,
  Droplets,
  User,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  Shield,
  ArrowLeft,
  Activity,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { z } from 'zod';
import { FloodReportSchema } from '@/lib/schemas';

const DynamicMapPicker = dynamic(
  () => import('@/components/map/MapPicker'),
  { ssr: false }
);
import { motion } from 'framer-motion';
import Image from 'next/image';

import { useLanguage } from '@/src/context/LanguageContext';

export default function LaporBanjirPage() {
  const { t } = useLanguage();
  const [location, setLocation] = useState<string>('');
  const [manualLocationInput, setManualLocationInput] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(-6.2088);
  const [longitude, setLongitude] = useState<number>(106.8456);
  const [waterLevel, setWaterLevel] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>('');
  const [reporterContact, setReporterContact] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [selectedPhoto, setSelectedPhoto] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const [errors, setErrors] = useState<z.ZodIssue[]>([]);
  const [predictionResult, setPredictionResult] = useState<number | null>(null);
  const [predictionRiskLabel, setPredictionRiskLabel] = useState<string | null>(null);

  const [supabase] = useState<SupabaseClient>(() =>
    createSupabaseBrowserClient(),
  );

  const waterLevelOptions = [
    { value: 'semata_kaki', label: 'Semata Kaki', color: 'text-emerald-400', borderColor: 'border-l-emerald-500', bgActive: 'bg-emerald-500/15 border-emerald-500/50', height: '< 30cm' },
    { value: 'selutut', label: 'Selutut', color: 'text-yellow-400', borderColor: 'border-l-yellow-500', bgActive: 'bg-yellow-500/15 border-yellow-500/50', height: '30-50cm' },
    { value: 'sepaha', label: 'Sepaha', color: 'text-orange-400', borderColor: 'border-l-orange-500', bgActive: 'bg-orange-500/15 border-orange-500/50', height: '50-80cm' },
    { value: 'sepusar', label: 'Sepusar', color: 'text-red-400', borderColor: 'border-l-red-500', bgActive: 'bg-red-500/15 border-red-500/50', height: '80-120cm' },
    { value: 'lebih_dari_sepusar', label: 'Lebih dari Sepusar', color: 'text-red-500', borderColor: 'border-l-red-600', bgActive: 'bg-red-500/20 border-red-500/50', height: '> 120cm' },
  ];

  const handleSearchLocation = async () => {
    if (!manualLocationInput) return;
    setLoading(true);
    setMessage('');
    setMessageType('');
    setErrors([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualLocationInput)}&format=json&limit=1`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setLatitude(parseFloat(lat));
        setLongitude(parseFloat(lon));
        setLocation(display_name);
        setMessage(t('reportFlood.locationFound'));
        setMessageType('success');
      } else {
        setMessage(t('reportFlood.locationNotFound'));
        setMessageType('error');
      }
    } catch (error: any) {
      console.error('Error searching location:', error);
      setMessage(`Gagal mencari lokasi: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto({
        file: file,
        preview: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');
    setErrors([]);
    setPredictionResult(null);
    setPredictionRiskLabel(null);

    const formData = {
      location, latitude, longitude,
      water_level: waterLevel,
      description, reporter_name: reporterName,
      reporter_contact: reporterContact,
    };

    const validationResult = FloodReportSchema.safeParse(formData);
    if (!validationResult.success) {
      setErrors(validationResult.error.issues);
      setMessage(t('reportFlood.validationError'));
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      const waterLevelMap: { [key: string]: number } = {
        'semata_kaki': 0, 'selutut': 1, 'sepaha': 2, 'sepusar': 3, 'lebih_dari_sepusar': 4,
      };
      const numericWaterLevel = waterLevelMap[validationResult.data.water_level];

      const predictionPayload = {
        latitude: validationResult.data.latitude,
        longitude: validationResult.data.longitude,
        water_level: numericWaterLevel,
        curah_hujan_24h: 0, kecepatan_angin: 0, suhu: 28, kelembapan: 80,
        ketinggian_air_cm: numericWaterLevel * 30,
        tren_air_6h: 0, mdpl: 0, jarak_sungai_m: 100, jumlah_banjir_5th: 0,
      };

      const predictionResponse = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionPayload),
      });

      if (!predictionResponse.ok) {
        const errorData = await predictionResponse.json();
        let detailedErrorMessage = 'Error tidak diketahui';
        if (errorData && errorData.detail && Array.isArray(errorData.detail)) {
          detailedErrorMessage = errorData.detail.map((err: any) => {
            const field = err.loc && err.loc.length > 1 ? err.loc[1] : 'unknown field';
            return `${field}: ${err.msg}`;
          }).join('; ');
        } else if (errorData && errorData.message) {
          detailedErrorMessage = errorData.message;
        }
        setMessage(`Gagal mendapatkan prediksi ML: ${detailedErrorMessage}`);
        setMessageType('error');
        setLoading(false);
        return;
      }
      const predictionData = await predictionResponse.json();
      setPredictionResult(predictionData.probability);

      const riskLabelMap: { [key: string]: string } = {
        'HIGH': t('reportFlood.riskHigh'),
        'MED': t('reportFlood.riskMedium'),
        'LOW': t('reportFlood.riskLow'),
      };
      const descriptiveRiskLabel = riskLabelMap[predictionData.risk_label] || predictionData.risk_label;
      setPredictionRiskLabel(descriptiveRiskLabel);

      setMessage(t('reportFlood.success'));
      setMessageType('success');

      let photoUrl = '';
      if (selectedPhoto) {
        const file = selectedPhoto.file;
        const filePath = `${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('laporan-banjir').upload(filePath, file);
        if (uploadError) throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage.from('laporan-banjir').getPublicUrl(filePath);
        photoUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('laporan_banjir')
        .insert([{
          location: validationResult.data.location,
          latitude: validationResult.data.latitude,
          longitude: validationResult.data.longitude,
          water_level: validationResult.data.water_level,
          description: validationResult.data.description,
          photo_url: photoUrl,
          reporter_name: validationResult.data.reporter_name,
          reporter_contact: validationResult.data.reporter_contact,
          prediction_risk: predictionData.risk_label,
          prediction_probability: predictionData.probability,
        }]);
      if (insertError) throw insertError;

      setLocation(''); setManualLocationInput(''); setLatitude(-6.2088); setLongitude(106.8456);
      setWaterLevel(''); setDescription(''); setReporterName(''); setReporterContact('');
      setSelectedPhoto(null); setErrors([]);
    } catch (error: any) {
      console.error('Error submitting report:', error.message);
      setMessage(`Gagal mengirim laporan: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTime = () => {
    return new Date().toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getErrorMessage = (path: string) => {
    const error = errors.find(err => err.path[0] === path);
    return error ? error.message : null;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans">
      {/* Header */}
      <header className="bg-white/[0.03] backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard?layout=tiling" className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-400 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </Link>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <h1 className="text-sm font-bold text-slate-200">{t('reportFlood.title')}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Droplets className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{t('common.noah.ai')}</h1>
              <p className="text-xs sm:text-sm text-cyan-400">{t('reportFlood.subtitle')}</p>
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/5 border-l-2 border-l-orange-500 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-base font-semibold text-white">{t('reportFlood.title')}</h2>
            </div>
            <p className="text-sm text-slate-400">{t('reportFlood.formDesc')}</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Message Display */}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border ${messageType === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
                  >
                    <div className="flex items-center gap-2">
                      {messageType === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      <p className="font-medium text-sm">{message}</p>
                    </div>
                    {predictionResult !== null && predictionRiskLabel !== null && messageType === 'success' && (
                      <div className="mt-2 text-sm space-y-1">
                        <p>{t('reportFlood.predictionRisk')}: <span className="font-bold text-white">{predictionRiskLabel}</span></p>
                        <p>{t('reportFlood.predictionProb')}: <span className="font-bold text-white">{(predictionResult * 100).toFixed(2)}%</span></p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Map Picker */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    {t('reportFlood.location')} <span className="text-red-400">*</span>
                  </label>
                  <div className="rounded-lg overflow-hidden border border-white/5">
                    <DynamicMapPicker
                      currentPosition={[latitude, longitude]}
                      onPositionChange={({ lat, lng }) => { setLatitude(lat); setLongitude(lng); }}
                      onLocationNameChange={setLocation}
                    />
                  </div>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      value={manualLocationInput}
                      onChange={(e) => setManualLocationInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchLocation(); }}}
                      placeholder={t('reportFlood.locationPlaceholder')}
                      className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all ${getErrorMessage('location') ? 'border-red-500/50' : 'border-white/5'}`}
                    />
                    <button
                      type="button"
                      onClick={handleSearchLocation}
                      disabled={loading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                  {getErrorMessage('location') && <p className="text-red-400 text-xs">{getErrorMessage('location')}</p>}
                  {getErrorMessage('latitude') && <p className="text-red-400 text-xs">{getErrorMessage('latitude')}</p>}
                  {getErrorMessage('longitude') && <p className="text-red-400 text-xs">{getErrorMessage('longitude')}</p>}
                  <p className="text-[11px] text-slate-500">{t('reportFlood.mapHint')}</p>
                </div>

                {/* Water Level */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    {t('reportFlood.waterLevel')} <span className="text-red-400">*</span>
                  </label>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${getErrorMessage('water_level') ? 'border border-red-500/30 rounded-lg p-2' : ''}`}>
                    {waterLevelOptions.map((option) => (
                      <label key={option.value} className="relative cursor-pointer">
                        <input
                          type="radio" name="waterLevel" value={option.value}
                          checked={waterLevel === option.value}
                          onChange={(e) => setWaterLevel(e.target.value)}
                          className="sr-only"
                        />
                        <div
                          className={`p-3 rounded-lg border-2 border-l-[3px] transition-all ${
                            waterLevel === option.value
                              ? `${option.bgActive} ${option.borderColor}`
                              : `border-white/5 ${option.borderColor} bg-white/[0.02] hover:bg-white/[0.04]`
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${waterLevel === option.value ? 'text-white' : 'text-slate-300'}`}>
                              {t(`reportFlood.waterLevelOptions.${option.value}`)}
                            </span>
                            <span className={`text-xs font-semibold ${option.color}`}>{option.height}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {getErrorMessage('water_level') && <p className="text-red-400 text-xs">{getErrorMessage('water_level')}</p>}
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    {t('reportFlood.photo')}
                  </label>
                  <div className="relative">
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" id="photo-upload" />
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all"
                    >
                      {selectedPhoto ? (
                        <div className="flex items-center gap-3">
                          <Image src={selectedPhoto.preview} alt="Preview" width={64} height={64} className="object-contain rounded-lg" />
                          <div>
                            <p className="text-sm text-white font-medium">{selectedPhoto.file.name}</p>
                            <p className="text-xs text-slate-400">{t('reportFlood.photoChange')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Camera className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">{t('reportFlood.photoPlaceholder')}</p>
                          <p className="text-xs text-slate-600">{t('reportFlood.photoFormats')}</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <FileText className="w-4 h-4 text-purple-400" />
                    {t('reportFlood.descLabel')}
                  </label>
                  <textarea
                    placeholder={t('reportFlood.descPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none ${getErrorMessage('description') ? 'border-red-500/50' : 'border-white/5'}`}
                  />
                  {getErrorMessage('description') && <p className="text-red-400 text-xs">{getErrorMessage('description')}</p>}
                </div>

                {/* Reporter Info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <User className="w-4 h-4 text-purple-400" /> {t('reportFlood.reporterName')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('reportFlood.reporterName')}
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all ${getErrorMessage('reporter_name') ? 'border-red-500/50' : 'border-white/5'}`}
                    />
                    {getErrorMessage('reporter_name') && <p className="text-red-400 text-xs">{getErrorMessage('reporter_name')}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Phone className="w-4 h-4 text-orange-400" /> {t('reportFlood.reporterContact')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('reportFlood.reporterContact')}
                      value={reporterContact}
                      onChange={(e) => setReporterContact(e.target.value)}
                      className={`w-full bg-white/5 border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all ${getErrorMessage('reporter_contact') ? 'border-red-500/50' : 'border-white/5'}`}
                    />
                    {getErrorMessage('reporter_contact') && <p className="text-red-400 text-xs">{getErrorMessage('reporter_contact')}</p>}
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('reportFlood.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> {t('reportFlood.submitButton')}
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Current Time */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white/[0.03] border border-white/5 border-l-2 border-l-cyan-500 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">{t('reportFlood.timeTitle')}</h3>
              </div>
              <p className="text-xl font-bold text-cyan-400">{getCurrentTime()}</p>
              <p className="text-[11px] text-slate-500 mt-1">{t('reportFlood.timeZone')}</p>
            </motion.div>

            {/* Guide */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="bg-white/[0.03] border border-white/5 rounded-xl p-4"
            >
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                {t('reportFlood.guideTitle')}
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                {[t('reportFlood.guide1'), t('reportFlood.guide2'), t('reportFlood.guide3'), t('reportFlood.guide4')].map((guide, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-md bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-cyan-400">{i + 1}</span>
                    </div>
                    <span className="text-slate-300 leading-relaxed">{guide}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Emergency Contacts */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="bg-emerald-500/5 border border-emerald-500/20 border-l-2 border-l-emerald-500 rounded-xl p-4"
            >
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                {t('reportFlood.emergencyContact')}
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'BPBD Jakarta', value: '164 / (021) 386 5090' },
                  { label: 'Damkar', value: '113 / (021) 386 5555' },
                  { label: 'Polri', value: '110 / (021) 721 8741' },
                ].map((contact) => (
                  <div key={contact.label} className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="text-slate-400">{contact.label}</span>
                    <span className="text-white font-semibold">{contact.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}