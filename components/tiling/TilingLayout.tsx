'use client';

import React, { useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DragDivider } from './DragDivider';
import { MobileSheet, type MobileSheetTab } from './MobileSheet';
import { TilingStatusBar } from './TilingStatusBar';
import './tiling.css';

/**
 * Desktop frame: left tile, master tile (map), right tile and a resizable
 * bottom tile. On phones (<768px) the side tiles collapse into a bottom sheet.
 * The layout holds no data; pages pass their own tile contents.
 */
export function TilingLayout({
  master,
  left,
  right,
  bottom,
  mobileTabs,
  renderMobileTab,
}: {
  master: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
  mobileTabs: MobileSheetTab[];
  renderMobileTab: (tabId: string) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [bottomHeight, setBottomHeight] = useLocalStorage('noah-bottom-tile-height', 160);

  return (
    <>
      <TilingStatusBar />
      <div ref={containerRef} className="tiling-root">
        {left && <div className="tiling-left tiling-tile">{left}</div>}
        <div className="tiling-master tiling-tile">{master}</div>
        {right && <div className="tiling-right tiling-tile">{right}</div>}
        {bottom && (
          <div className="tiling-bottom-area" style={{ height: bottomHeight }}>
            <DragDivider
              onResize={setBottomHeight}
              containerRef={containerRef}
              minHeight={40}
              maxHeight={400}
            />
            <div className="tiling-tile flex-1 overflow-hidden">{bottom}</div>
          </div>
        )}
      </div>

      {isMobile && <MobileSheet tabs={mobileTabs}>{renderMobileTab}</MobileSheet>}
    </>
  );
}
