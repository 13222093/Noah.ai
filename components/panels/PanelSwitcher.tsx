'use client';

import React from 'react';
import { usePanel, PanelId } from './PanelContext';
import { DataPanel } from './DataPanel';
import { AIToolsPanel } from './AIToolsPanel';
import { WeatherPanel } from './WeatherPanel';

interface PanelSwitcherProps {
  /** Data passed through for panels that need it */
  alerts: any[];
  waterLevelPosts: any[];
  pumpStatusData: any[];
  /** Freshness timestamp */
  timeAgo?: string;
  /** The default alert panel component */
  AlertPanelComponent: React.ComponentType<{ alerts: any[]; timeAgo?: string }>;
}

export function PanelSwitcher({
  alerts,
  waterLevelPosts,
  pumpStatusData,
  timeAgo,
  AlertPanelComponent,
}: PanelSwitcherProps) {
  const { activePanel } = usePanel();

  switch (activePanel) {
    case 'data':
      return <DataPanel waterLevelPosts={waterLevelPosts} pumpStatusData={pumpStatusData} timeAgo={timeAgo} />;
    case 'ai-tools':
      return <AIToolsPanel />;
    case 'weather':
      return <WeatherPanel />;
    case 'alerts':
    default:
      return <AlertPanelComponent alerts={alerts} timeAgo={timeAgo} />;
  }
}
