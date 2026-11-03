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
  // Removes the document listeners of the drag in progress, if any.
  const stopDragRef = useRef<(() => void) | null>(null);

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

  const handleStart = useCallback(() => {
    stopDragRef.current?.();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientY);
    };
    const stop = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', stop);
      stopDragRef.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', stop);
    stopDragRef.current = stop;
  }, [handleMove]);

  // Cleanup on unmount
  useEffect(() => () => stopDragRef.current?.(), []);

  return (
    <div
      ref={dividerRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      className={cn(
        'op-drag-divider',
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
          'group-hover:bg-op-accent/60',
        )}
      />
      {/* Grab indicator dots */}
      <div className="flex gap-1 z-10">
        <div className="h-1 w-1 rounded-full bg-white/20 transition-colors group-hover:bg-op-accent/60" />
        <div className="h-1 w-1 rounded-full bg-white/20 transition-colors group-hover:bg-op-accent/60" />
        <div className="h-1 w-1 rounded-full bg-white/20 transition-colors group-hover:bg-op-accent/60" />
      </div>
    </div>
  );
}
