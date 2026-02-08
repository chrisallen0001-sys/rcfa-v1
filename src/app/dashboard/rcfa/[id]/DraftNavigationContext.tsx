"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DraftNavigationContextValue {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

const DraftNavigationContext = createContext<DraftNavigationContextValue | null>(null);

export function DraftNavigationProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirtyState] = useState(false);

  const setIsDirty = useCallback((dirty: boolean) => {
    setIsDirtyState(dirty);
  }, []);

  return (
    <DraftNavigationContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </DraftNavigationContext.Provider>
  );
}

export function useDraftNavigation() {
  return useContext(DraftNavigationContext);
}
