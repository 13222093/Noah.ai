'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MobileSheetTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

// Snap heights: px for the peek (handle + tab bar), else a share of the
// container the sheet sits in (the map area, between status and playback bars).
const PEEK_HEIGHT = 64; // px - handle plus tab bar
const HALF_HEIGHT = 0.5;
const FULL_HEIGHT = 0.94;

interface MobileSheetProps {
  tabs: MobileSheetTab[];
  children: (activeTab: string) => React.ReactNode;
}

export function MobileSheet({ tabs, children }: MobileSheetProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [isFullExpanded, setIsFullExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Drag only from the handle, so lists inside the sheet scroll normally.
  const dragControls = useDragControls();
  const [containerH, setContainerH] = useState(600);

  useEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setContainerH(h);
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const getHeight = () => {
    if (!isOpen) return PEEK_HEIGHT;
    if (isFullExpanded) return containerH * FULL_HEIGHT;
    return containerH * HALF_HEIGHT;
  };

  const handleTabClick = (tabId: string) => {
    if (!isOpen) {
      setIsOpen(true);
      setActiveTab(tabId);
    } else if (activeTab === tabId) {
      // Toggle between half and full
      setIsFullExpanded(!isFullExpanded);
    } else {
      setActiveTab(tabId);
    }
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsFullExpanded(false);
  }, []);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const { velocity, offset } = info;
      if (velocity.y > 500 || offset.y > 100) {
        if (isFullExpanded) {
          setIsFullExpanded(false);
        } else {
          handleClose();
        }
      } else if (velocity.y < -500 || offset.y < -100) {
        if (!isOpen) {
          setIsOpen(true);
        } else if (!isFullExpanded) {
          setIsFullExpanded(true);
        }
      }
    },
    [isOpen, isFullExpanded, handleClose],
  );

  return (
    <motion.div
      ref={sheetRef}
      className="op-mobile-sheet"
      animate={{
        height: getHeight(),
      }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
    >
      {/* Drag handle */}
      <div
        className="op-mobile-sheet-handle"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="op-mobile-sheet-handle-bar" />
      </div>

      {/* Tab bar */}
      <div className="op-mobile-sheet-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            aria-expanded={isOpen && activeTab === tab.id}
            className={cn(
              'op-mobile-sheet-tab',
              activeTab === tab.id && isOpen && 'op-mobile-sheet-tab-active',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        {isOpen && (
          <button onClick={handleClose} className="op-mobile-sheet-close" aria-label="Tutup">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="op-mobile-sheet-content"
          >
            {children(activeTab)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
