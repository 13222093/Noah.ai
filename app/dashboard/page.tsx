import { fetchBmkgLatestQuake } from '@/lib/api.client';

export const revalidate = 300;
import { BmkgGempaData } from '@/lib/api';
import { CommandCenterView } from '@/components/layout/CommandCenterView';
import { generateMockWaterLevels, generateMockPumpStatus } from '@/lib/mock-data';

export default async function DashboardPage() {
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
    const peopleAtRisk = realTimeAlerts.reduce((total) => {
        return total + Math.floor(Math.random() * (5000 - 500 + 1) + 500);
    }, 0);

    const initialData = {
        stats: {
            totalRegions: uniqueRegions,
            activeAlerts: activeAlertsCount,
            floodZones: floodZoneCount,
            peopleAtRisk: peopleAtRisk,
        },
        waterLevelPosts,
        pumpStatusData,
        latestQuake,
        quakeError,
        realTimeAlerts,
    };

    return <CommandCenterView initialData={initialData} />;
}
