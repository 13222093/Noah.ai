'use client';

import { createContext, useContext, ReactNode } from 'react';
import { BmkgGempaData } from '@/lib/api';

export interface DashboardStats {
  totalRegions: number;
  activeAlerts: number;
  floodZones: number;
  peopleAtRisk: number;
  mlHealth: { lstmReady: boolean; visionReady: boolean };
}

export interface DashboardData {
  stats: DashboardStats;
  waterLevelPosts: any[];
  pumpStatusData: any[];
  latestQuake: BmkgGempaData | null;
  quakeError: string | null;
  realTimeAlerts: any[];
}

const DashboardDataContext = createContext<DashboardData | null>(null);

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error(
      'useDashboardData must be used within DashboardDataProvider',
    );
  }
  return ctx;
}

export function DashboardDataProvider({
  data,
  children,
}: {
  data: DashboardData;
  children: ReactNode;
}) {
  return (
    <DashboardDataContext.Provider value={data}>
      {children}
    </DashboardDataContext.Provider>
  );
}
