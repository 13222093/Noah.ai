'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

interface DashboardStats {
  activeAlerts: number;
  floodZones: number;
  peopleAtRisk: number;
  totalRegions?: number;
}

interface StatsContextType {
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;
}

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStatsState] = useState<DashboardStats | null>(null);

  const setStats = useCallback((newStats: DashboardStats) => {
    setStatsState(newStats);
  }, []);

  const value = useMemo(() => ({ stats, setStats }), [stats, setStats]);

  return (
    <StatsContext.Provider value={value}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStats() {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
}
