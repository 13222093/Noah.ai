// FILE: app/statistika/page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Gauge,
  TrendingUp,
  Clock,
  Users,
  Shield,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  History,
} from 'lucide-react';

import { useLanguage } from '@/src/context/LanguageContext';

import { PageShell } from '@/components/layout/PageShell';

import { Button } from '@/components/ui/Button';
import { HistoricalIncident, ChartDataPoint, StatCard } from './statistika.types';
import { generateChartData } from './statistika.utils';
import GeminiChatSection from './components/GeminiChatSection';
import StatistikOverview from './components/StatistikOverview';
import StatistikHistorical from './components/StatistikHistorical';

// Definisikan tipe ChatMessage di sini agar bisa diakses oleh state
interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type?: 'info' | 'warning' | 'success';
}

export default function StatistikPage() {
  const { t } = useLanguage();
  // State utama
  const [activeTab, setActiveTab] = useState<'overview' | 'historical'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State data
  const [historicalIncidents, setHistoricalIncidents] = useState<HistoricalIncident[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // State filter & sort
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // State Gemini
  const [geminiQuestion, setGeminiQuestion] = useState('');
  const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Fetch data insiden
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/statistics/incidents');
      if (!response.ok) throw new Error('Gagal mengambil data insiden');
      const data: HistoricalIncident[] = await response.json();
      setHistoricalIncidents(data);
      setChartData(generateChartData(data));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Update chart berdasarkan tanggal
  useEffect(() => {
    const filteredByDate = historicalIncidents.filter((incident) => {
      if (!startDate && !endDate) return true;
      const incidentDate = new Date(incident.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      if (start && incidentDate < start) return false;
      if (end && incidentDate > end) return false;
      return true;
    });
    setChartData(generateChartData(filteredByDate));
  }, [startDate, endDate, historicalIncidents]);

  // Stat cards
  const statCards: StatCard[] = [
    {
      title: t('statistika.overview.stats.totalIncidents'),
      value: historicalIncidents.length,
      change: 12,
      changeType: 'increase',
      icon: <Activity className="w-6 h-6" />,
      color: 'blue',
      trend: [],
      description: t('statistika.overview.stats.descTotalIncidents'),
    },
    {
      title: t('statistika.overview.stats.evacuees'),
      value: historicalIncidents
        .reduce((acc, curr) => acc + (curr.evacuees || 0), 0)
        .toLocaleString('id-ID'),
      change: 20,
      changeType: 'increase',
      icon: <Shield className="w-6 h-6" />,
      color: 'cyan',
      trend: [],
      description: t('statistika.overview.stats.descEvacuees'),
    },
  ];

  // Filter & sort
  const filteredIncidents = historicalIncidents
    .filter((incident) => filterType === 'all' || incident.type.toLowerCase() === filterType.toLowerCase())
    .filter(
      (incident) =>
        incident.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc'
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'severity') {
        return sortOrder === 'desc' ? b.severity - a.severity : a.severity - b.severity;
      } else {
        return sortOrder === 'desc' ? b.type.localeCompare(a.type) : a.type.localeCompare(b.type);
      }
    });

  // Gemini handler (unchanged)
  const handleGeminiAnalysis = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setIsGeminiLoading(true);
    setGeminiResponse(null);

    const userMessage: ChatMessage = { id: Date.now().toString(), text: question, isUser: true, timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const historyForApi = newMessages.filter(msg => msg.id !== 'welcome').map(msg => ({ role: msg.isUser ? 'user' : 'model', parts: [{ text: msg.text }] }));

    try {
      const response = await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, history: historyForApi.slice(0, -1) }) });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'API error'); }
      const data = await response.json();

      if (data.action === 'REQUEST_LOCATION') {
        setMessages(prev => [...prev, { id: 'loc-req', text: 'Location access needed.', isUser: false, timestamp: new Date(), type: 'info' }]);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setMessages(prev => [...prev, { id: 'loc-ok', text: `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, isUser: false, timestamp: new Date(), type: 'success' }]);
            const historyWithFn = [...historyForApi, { role: 'model', parts: [{ functionCall: data.originalCall }] }];
            const fnResponse = { role: 'function', parts: [{ functionResponse: { name: 'requestUserLocation', response: { success: true, latitude, longitude } } }] };
            const finalHistory = [...historyWithFn, fnResponse];
            const finalRes = await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '', history: finalHistory }) });
            if (!finalRes.ok) throw new Error('Follow-up API error');
            const finalData = await finalRes.json();
            setGeminiResponse(finalData.answer);
            setIsGeminiLoading(false);
          },
          () => { setMessages(prev => [...prev, { id: 'loc-err', text: 'Location access denied.', isUser: false, timestamp: new Date(), type: 'warning' }]); setIsGeminiLoading(false); }
        );
      } else {
        setGeminiResponse(data.answer);
        setIsGeminiLoading(false);
      }
    } catch (err: any) {
      setGeminiResponse(`Error: ${err.message}`);
      setIsGeminiLoading(false);
    }
  }, [messages]);

  if (isLoading) {
    return (
      <PageShell title={t('statistika.title')} icon={<BarChart3 className="w-4 h-4" />}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-cc-cyan animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title={t('statistika.title')} icon={<BarChart3 className="w-4 h-4" />}>
        <div className="flex items-center justify-center h-64">
          <p className="text-cc-critical font-semibold">Error: {error}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t('statistika.title')} icon={<BarChart3 className="w-4 h-4" />}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button onClick={() => setActiveTab('overview')} variant={activeTab === 'overview' ? 'default' : 'outline'}>
            {t('statistika.tabs.overview')}
          </Button>
          <Button onClick={() => setActiveTab('historical')} variant={activeTab === 'historical' ? 'default' : 'outline'}>
            {t('statistika.tabs.historical')}
          </Button>
          <Button onClick={() => setShowFilters((prev) => !prev)} variant="outline">
            <Filter className="w-4 h-4 mr-1" /> {t('statistika.filters.button')}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-cc-surface rounded-lg p-4 shadow-sm border border-cc-border"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-cc-text-secondary">{t('statistika.filters.startDate')}</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-cc-elevated border border-cc-border rounded text-cc-text" />
                </div>
                <div>
                  <label className="text-sm text-cc-text-secondary">{t('statistika.filters.endDate')}</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-cc-elevated border border-cc-border rounded text-cc-text" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StatistikOverview statCards={statCards} chartData={chartData} />
            </motion.div>
          )}
          {activeTab === 'historical' && (
            <motion.div key="historical" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StatistikHistorical
                filteredIncidents={filteredIncidents}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                viewMode={viewMode}
                setViewMode={setViewMode}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <GeminiChatSection
          geminiQuestion={geminiQuestion}
          setGeminiQuestion={setGeminiQuestion}
          geminiResponse={geminiResponse}
          isGeminiLoading={isGeminiLoading}
          handleGeminiAnalysis={handleGeminiAnalysis}
        />
      </div>
    </PageShell>
  );
}
