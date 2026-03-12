import { fetchBmkgLatestQuake } from '@/lib/api.client';

export const revalidate = 300;
import { BmkgGempaData } from '@/lib/api';
import { CommandCenterView } from '@/components/layout/CommandCenterView';
import { DashboardDataProvider } from '@/components/tiling/DashboardDataContext';
import { TilingLayout } from '@/components/tiling/TilingLayout';
import { TilingModeProvider } from '@/components/tiling/TilingModeContext';
import { generateMockWaterLevels, generateMockPumpStatus } from '@/lib/mock-data';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ layout?: string }>;
}) {
    const params = await searchParams;
    const useTiling = params.layout !== 'classic'; // Tiling is default, use ?layout=classic for old view

    // Fetch BMKG earthquake data
    let latestQuake: BmkgGempaData | null = null;
    let quakeError: string | null = null;
    try {
        latestQuake = await fetchBmkgLatestQuake();
    } catch (error: any) {
        quakeError = error.message;
        console.error('Error fetching BMKG quake data:', error);
    }

    // Generate mock data (in production: from DB / live API)
    const waterLevelPosts = generateMockWaterLevels(100);
    const pumpStatusData = generateMockPumpStatus(100);

    const { FLOOD_MOCK_ALERTS } = await import('@/lib/constants');
    const realTimeAlerts = [...FLOOD_MOCK_ALERTS];

    // Calculate dynamic stats
    const allLocations = [...waterLevelPosts.map(p => p.name), ...pumpStatusData.map(p => p.lokasi)];
    const uniqueRegions = new Set(allLocations.map(loc => loc?.split(',')[0].trim())).size;
    const activeAlertsCount = realTimeAlerts.length;
    const floodZoneCount = waterLevelPosts.filter(p => p.status !== 'Normal').length;
    const peopleAtRisk = realTimeAlerts.reduce((total, alert: any) => {
        return total + (alert.estimatedPopulation || 2500);
    }, 0);

    // Check ML health (simple HEAD check — matches StatusBar pattern)
    let mlHealth = { lstmReady: false, visionReady: false };
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const [lstmRes, visionRes] = await Promise.allSettled([
            fetch(`${baseUrl}/api/flood-predict`, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok),
            fetch(`${baseUrl}/api/cctv-scan`, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok || r.status === 405),
        ]);
        mlHealth = {
            lstmReady: lstmRes.status === 'fulfilled' && lstmRes.value === true,
            visionReady: visionRes.status === 'fulfilled' && visionRes.value === true,
        };
    } catch { /* silently default to false */ }

    const initialData = {
        stats: {
            totalRegions: uniqueRegions,
            activeAlerts: activeAlertsCount,
            floodZones: floodZoneCount,
            peopleAtRisk: peopleAtRisk,
            mlHealth,
        },
        waterLevelPosts,
        pumpStatusData,
        latestQuake,
        quakeError,
        realTimeAlerts,
    };

    if (useTiling) {
        return (
            <TilingModeProvider>
                <DashboardDataProvider data={initialData}>
                    <TilingLayout />
                </DashboardDataProvider>
            </TilingModeProvider>
        );
    }

    return <CommandCenterView initialData={initialData} />;
}
