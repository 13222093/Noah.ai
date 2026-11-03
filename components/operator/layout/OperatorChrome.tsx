'use client';

// Frame for the operator section (/operator/**). The app shell leaves these
// routes chrome-less (components/layout/ClientLayoutWrapper.tsx), like the
// tiling dashboard, so this frame draws the dashboard-style top bar itself.
// It mounts the shared replay clock once so it keeps running across the
// operator pages, keeps the REPLAY chip and its scenario disclosure on screen
// at all times (top bar), and docks the replay controls at the bottom.

import React from 'react';
import { PlaybackController } from '@/components/operator/ops/PlaybackController';
import { PlaybackBar } from '@/components/operator/ops/PlaybackBar';
import { OperatorTopBar } from './OperatorTopBar';

export function OperatorChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="op-charts flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-op-page font-sans text-op-fg">
      <PlaybackController />
      <OperatorTopBar />
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
      <PlaybackBar className="shrink-0" />
    </div>
  );
}
