import { Suspense, lazy } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { DataSensorSkeleton } from '@/components/sensor-data/DataSensorSkeleton';
import { StatisticsDashboardSkeleton } from '@/components/dashboard/StatisticsDashboardSkeleton';
import DataSensorHeader from '@/components/sensor-data/DataSensorHeader';
import DataSensorError from '@/components/sensor-data/DataSensorError';

const DataSensorClientContent = lazy(() => import('@/components/sensor-data/DataSensorClientContent'));
const StatisticsDashboard = lazy(() => import('@/components/dashboard/StatisticsDashboard'));

export const revalidate = 30;

async function DataSensorPage() {
  let laporan: any[] | null = null;
  let error: { message: string } | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const result = await supabase
        .from('laporan_banjir')
        .select('*')
        .order('created_at', { ascending: false });
      laporan = result.data;
      error = result.error;
    } catch (e: any) {
      error = { message: e.message };
    }
  }

  // The main page layout is returned immediately, not blocked by the data fetch
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-white font-sans">
      {/* Header */}
      <header className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <DataSensorHeader />
        </div>
      </header>

      {/* Konten Utama */}
      <main className="container mx-auto px-6 py-8">
        <Suspense fallback={<StatisticsDashboardSkeleton />}>
          <StatisticsDashboard />
        </Suspense>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg mt-8">
          {error ? (
            <DataSensorError message={error.message} />
          ) : (
            <Suspense fallback={<DataSensorSkeleton />}>
              <DataSensorClientContent initialLaporan={laporan || []} />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}

export default DataSensorPage;
