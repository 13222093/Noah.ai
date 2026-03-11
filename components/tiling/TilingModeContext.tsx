'use client';

import { createContext, useContext } from 'react';

/**
 * Simple flag context: when true, ClientLayoutWrapper
 * skips the NavRail/StatusBar shell so the tiling layout
 * can render its own structure.
 */
const TilingModeContext = createContext(false);

export const useTilingMode = () => useContext(TilingModeContext);

export function TilingModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <TilingModeContext.Provider value={true}>
      {children}
    </TilingModeContext.Provider>
  );
}
