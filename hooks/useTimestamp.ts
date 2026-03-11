'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

function getTimeAgoString(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Hook for tracking data freshness.
 * Call markUpdated() after a fetch completes.
 * timeAgo auto-refreshes every 30s.
 */
export function useTimestamp() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const markUpdated = useCallback(() => {
    const now = new Date();
    setLastUpdated(now);
    setTimeAgo(getTimeAgoString(now));
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;

    intervalRef.current = setInterval(() => {
      setTimeAgo(getTimeAgoString(lastUpdated));
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lastUpdated]);

  return { lastUpdated, markUpdated, timeAgo };
}
