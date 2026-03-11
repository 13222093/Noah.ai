'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  AlertTriangle,
  Activity,
  Cloud,
  Brain,
  ChevronUp,
  X,
  Droplets,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileSheetTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const MOBILE_TABS: MobileSheetTab[] = [
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={16} /> },
  { id: 'sensor', label: 'Sensor', icon: <Activity size={16} /> },
  { id: 'weather', label: 'Weather', icon: <Cloud size={16} /> },
  { id: 'ai', label: 'AI', icon: <Brain size={16} /> },
  { id: 'water', label: 'Water', icon: <Droplets size={16} /> },
];

// Snap heights as vh percentages
const PEEK_HEIGHT = 48; // px - just the tab bar
const HALF_HEIGHT = 45; // vh
const FULL_HEIGHT = 85; // vh

interface MobileSheetProps {
  children: (activeTab: string) => React.ReactNode;
}

export function MobileSheet({ children }: MobileSheetProps) {
  const [activeTab, setActiveTab] = useState('alerts');
  const [isOpen, setIsOpen] = useState(false);
  const [isFullExpanded, setIsFullExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const getHeight = () => {
    if (!isOpen) return PEEK_HEIGHT;
    if (isFullExpanded) return window.innerHeight * (FULL_HEIGHT / 100);
    return window.innerHeight * (HALF_HEIGHT / 100);
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
      className="mobile-sheet"
      animate={{
        height: getHeight(),
      }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
    >
      {/* Drag handle */}
      <div className="mobile-sheet-handle">
        <div className="mobile-sheet-handle-bar" />
      </div>

      {/* Tab bar */}
      <div className="mobile-sheet-tabs">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'mobile-sheet-tab',
              activeTab === tab.id && isOpen && 'mobile-sheet-tab-active',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
        {isOpen && (
          <button onClick={handleClose} className="mobile-sheet-close">
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
            className="mobile-sheet-content"
          >
            {children(activeTab)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
