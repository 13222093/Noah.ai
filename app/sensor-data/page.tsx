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

  // Mock data fallback when Supabase has no data
  if (!laporan || laporan.length === 0) {
    const waterLevels = ['semata_kaki', 'selutut', 'sepaha', 'sepusar', 'lebih_dari_sepusar'];
    const locations = [
      { name: 'Kampung Melayu, Jakarta Timur', lat: -6.2396, lon: 106.8653 },
      { name: 'Cawang, Jakarta Timur', lat: -6.2443, lon: 106.8698 },
      { name: 'Rawajati, Jakarta Selatan', lat: -6.2597, lon: 106.8545 },
      { name: 'Bukit Duri, Jakarta Selatan', lat: -6.2263, lon: 106.8544 },
      { name: 'Bidara Cina, Jakarta Timur', lat: -6.2290, lon: 106.8595 },
      { name: 'Cipinang Melayu, Jakarta Timur', lat: -6.2710, lon: 106.9090 },
      { name: 'Kelapa Gading, Jakarta Utara', lat: -6.1527, lon: 106.9080 },
      { name: 'Penjaringan, Jakarta Utara', lat: -6.1166, lon: 106.8070 },
      { name: 'Manggarai, Jakarta Selatan', lat: -6.2115, lon: 106.8510 },
      { name: 'Sunter, Jakarta Utara', lat: -6.1445, lon: 106.8730 },
      { name: 'Cengkareng, Jakarta Barat', lat: -6.1383, lon: 106.7169 },
      { name: 'Ciracas, Jakarta Timur', lat: -6.3270, lon: 106.8760 },
      { name: 'Tebet, Jakarta Selatan', lat: -6.2260, lon: 106.8560 },
      { name: 'Jatinegara, Jakarta Timur', lat: -6.2153, lon: 106.8720 },
      { name: 'Kemayoran, Jakarta Pusat', lat: -6.1534, lon: 106.8530 },
    ];
    const descriptions = [
      'Air meluap dari sungai ke jalan utama. Arus cukup deras.',
      'Genangan air di permukiman warga, ketinggian naik perlahan.',
      'Banjir kiriman dari hulu, warga mulai mengungsi.',
      'Drainase tersumbat, genangan meluas ke area pasar.',
      'Air sungai meluap akibat hujan lebat semalaman.',
      'Kondisi membaik, air mulai surut perlahan.',
      'Jalan utama tergenang, lalu lintas dialihkan.',
      'Pompa air aktif membantu menyedot genangan.',
    ];
    const reporters = ['Bapak Ahmad', 'Ibu Siti', 'Pak Budi', 'Bu Dewi', 'Pak Hendra', 'Bu Ratna', 'Pak Joko'];

    laporan = Array.from({ length: 50 }, (_, i) => {
      const loc = locations[i % locations.length];
      const hoursAgo = Math.floor(Math.random() * 72);
      return {
        id: `mock-${i + 1}`,
        location: loc.name,
        latitude: loc.lat + (Math.random() - 0.5) * 0.01,
        longitude: loc.lon + (Math.random() - 0.5) * 0.01,
        water_level: waterLevels[Math.floor(Math.random() * waterLevels.length)],
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        reporter_name: reporters[Math.floor(Math.random() * reporters.length)],
        reporter_contact: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        created_at: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      };
    });
    error = null;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans">
      {/* Header */}
      <header className="bg-white/[0.03] backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <DataSensorHeader />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-6 py-8">
        <Suspense fallback={<StatisticsDashboardSkeleton />}>
          <StatisticsDashboard />
        </Suspense>

        <div className="bg-white/[0.03] rounded-xl p-6 border border-white/5 mt-8">
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
