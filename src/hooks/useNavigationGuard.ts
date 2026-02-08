"use client";

import { useEffect, useRef } from "react";

// Global dirty check function - set by components that need navigation guarding
let globalDirtyCheck: (() => boolean) | null = null;

/**
 * Register a global dirty check function.
 * Only one can be active at a time (last one wins).
 */
export function setGlobalDirtyCheck(check: (() => boolean) | null) {
  globalDirtyCheck = check;
}

/**
 * Check if there are unsaved changes and prompt user for confirmation.
 * Returns true if navigation should proceed, false if it should be blocked.
 */
export function checkUnsavedChanges(): boolean {
  if (globalDirtyCheck?.()) {
    return window.confirm(
      "You have unsaved changes. Are you sure you want to leave this page?"
    );
  }
  return true;
}

/**
 * Hook to register a component's dirty state with the global navigation guard.
 * Also handles browser back button via popstate.
 */
export function useNavigationGuard(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);

  // Keep ref in sync with state (must be in effect, not during render)
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    // Register this component's dirty check globally
    setGlobalDirtyCheck(() => isDirtyRef.current);

    // Handle browser back button
    function handlePopState() {
      if (isDirtyRef.current) {
        // Push current URL back to prevent navigation
        window.history.pushState(null, "", window.location.href);
        const confirmed = window.confirm(
          "You have unsaved changes. Are you sure you want to leave this page?"
        );
        if (confirmed) {
          // Clear dirty state to prevent loop when back() triggers another popstate
          isDirtyRef.current = false;
          setGlobalDirtyCheck(null);
          window.history.back();
        }
      }
    }

    // Replace current state to enable popstate interception without polluting history
    window.history.replaceState({ guardActive: true }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      setGlobalDirtyCheck(null);
    };
  }, []);
}
