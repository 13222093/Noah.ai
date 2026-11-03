'use client';

import React, { useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { DragDivider } from './DragDivider';
import { MobileSheet, type MobileSheetTab } from './MobileSheet';
import './operator-tiling.css';

/**
 * Desktop frame: optional left tile, master tile (map), right tile and an
 * optional resizable bottom tile. From 768 to 1279 px the left tile is hidden
 * (pages fold its content into the right tile); on phones (<768px) the side
 * tiles collapse into a bottom sheet. The layout holds no data.
 */
export function TilingLayout({
  master,
  left,
  right,
  bottom,
  mobileTabs,
  renderMobileTab,
  rightWidth,
  leftWidth,
}: {
  master: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
  mobileTabs: MobileSheetTab[];
  renderMobileTab: (tabId: string) => React.ReactNode;
  rightWidth?: number;
  leftWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [bottomHeight, setBottomHeight] = useLocalStorage('noah-operator-bottom-tile-height', 160);

  const style = {
    ...(rightWidth ? { ['--op-tiling-right-w' as string]: `${rightWidth}px` } : {}),
    ...(leftWidth ? { ['--op-tiling-left-w' as string]: `${leftWidth}px` } : {}),
  } as React.CSSProperties;

  return (
    <div className="op-tiling-wrap">
      <div ref={containerRef} className={cn('op-tiling-root', !left && 'op-tiling-root--no-left')} style={style}>
        {left && <div className="op-tiling-left op-tiling-tile">{left}</div>}
        <div className="op-tiling-master op-tiling-tile">{master}</div>
        {right && <div className="op-tiling-right op-tiling-tile">{right}</div>}
        {bottom && (
          <div className="op-tiling-bottom-area" style={{ height: bottomHeight }}>
            <DragDivider onResize={setBottomHeight} containerRef={containerRef} minHeight={40} maxHeight={400} />
            <div className="op-tiling-tile flex-1 overflow-hidden">{bottom}</div>
          </div>
        )}
      </div>

      {isMobile && <MobileSheet tabs={mobileTabs}>{renderMobileTab}</MobileSheet>}
    </div>
  );
}
