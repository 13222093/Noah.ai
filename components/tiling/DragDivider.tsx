'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DragDividerProps {
  onResize: (newHeight: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  minHeight?: number;
  maxHeight?: number;
}

export function DragDivider({
  onResize,
  containerRef,
  minHeight = 40,
  maxHeight = 400,
}: DragDividerProps) {
  const isDragging = useRef(false);
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientY: number) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - clientY;
      const clamped = Math.min(maxHeight, Math.max(minHeight, newHeight));
      onResize(clamped);
    },
    [containerRef, minHeight, maxHeight, onResize],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => handleMove(e.clientY),
    [handleMove],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY);
      }
    },
    [handleMove],
  );

  const handleEnd = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleEnd);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleEnd);
  }, [handleMouseMove, handleTouchMove]);

  const handleStart = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);
  }, [handleMouseMove, handleTouchMove, handleEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [handleMouseMove, handleTouchMove, handleEnd]);

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      className={cn(
        'drag-divider',
        'relative flex items-center justify-center',
        'h-[6px] cursor-row-resize select-none shrink-0',
        'group z-10',
      )}
    >
      {/* Visual line */}
      <div
        className={cn(
          'absolute inset-x-0 top-1/2 -translate-y-1/2',
          'h-[2px] bg-white/10 transition-colors duration-150',
          'group-hover:bg-blue-500/60',
        )}
      />
      {/* Grab indicator dots */}
      <div className="flex gap-1 z-10">
        <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
        <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
        <div className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
      </div>
    </div>
  );
}
