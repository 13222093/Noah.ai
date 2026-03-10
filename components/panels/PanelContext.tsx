'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type PanelId =
  | 'alerts'       // Default: alert feed
  | 'data'         // Water levels + pump status + sensor data
  | 'weather'      // Full weather detail
  | 'alert-detail' // Specific alert + AI analysis
  | 'evacuation'   // Evacuation location detail
  | 'cctv'         // CCTV feeds
  | 'ai-tools';    // AI tools menu (LSTM, YOLO, CCTV links)

interface PanelContextType {
  activePanel: PanelId;
  panelData: any;
  setPanel: (panel: PanelId, data?: any) => void;
  resetPanel: () => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelId>('alerts');
  const [panelData, setPanelData] = useState<any>(null);

  const setPanel = useCallback((panel: PanelId, data?: any) => {
    setActivePanel(panel);
    setPanelData(data ?? null);
  }, []);

  const resetPanel = useCallback(() => {
    setActivePanel('alerts');
    setPanelData(null);
  }, []);

  return (
    <PanelContext.Provider value={{ activePanel, panelData, setPanel, resetPanel }}>
      {children}
    </PanelContext.Provider>
  );
}

export function usePanel() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanel must be used within a PanelProvider');
  }
  return context;
}
