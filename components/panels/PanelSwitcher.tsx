'use client';

import React from 'react';
import { usePanel, PanelId } from './PanelContext';
import { DataPanel } from './DataPanel';
import { AIToolsPanel } from './AIToolsPanel';

interface PanelSwitcherProps {
  /** Data passed through for panels that need it */
  alerts: any[];
  waterLevelPosts: any[];
  pumpStatusData: any[];
  /** The default alert panel component */
  AlertPanelComponent: React.ComponentType<{ alerts: any[] }>;
}

export function PanelSwitcher({
  alerts,
  waterLevelPosts,
  pumpStatusData,
  AlertPanelComponent,
}: PanelSwitcherProps) {
  const { activePanel } = usePanel();

  switch (activePanel) {
    case 'data':
      return <DataPanel waterLevelPosts={waterLevelPosts} pumpStatusData={pumpStatusData} />;
    case 'ai-tools':
      return <AIToolsPanel />;
    case 'alerts':
    default:
      return <AlertPanelComponent alerts={alerts} />;
  }
}
