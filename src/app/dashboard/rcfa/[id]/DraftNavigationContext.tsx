"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";

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

  // Register with global navigation guard for browser back button and GuardedLink
  useNavigationGuard(isDirty);

  return (
    <DraftNavigationContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </DraftNavigationContext.Provider>
  );
}

export function useDraftNavigation() {
  return useContext(DraftNavigationContext);
}
