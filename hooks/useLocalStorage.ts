'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * SSR-safe localStorage persistence hook.
 * Initializes to defaultValue on server/first render,
 * syncs from localStorage after mount to avoid hydration mismatch.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Sync from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored));
      }
    } catch {
      // localStorage unavailable or invalid JSON — keep default
    }
  }, [key]);

  const setAndPersist = useCallback(
    (newValue: T) => {
      setValue(newValue);
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // localStorage full or unavailable
      }
    },
    [key],
  );

  return [value, setAndPersist];
}
