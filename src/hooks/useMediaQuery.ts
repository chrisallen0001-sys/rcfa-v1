"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Concurrent-mode-safe media query hook using `useSyncExternalStore`.
 *
 * Each hook instance manages its own `matchMedia` subscription, so there
 * is no module-level state to coordinate.
 *
 * SSR-safe: returns `false` when `window` is not available.
 *
 * @param query - A CSS media query string, e.g. `"(max-width: 639px)"`
 * @returns Whether the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience hook that returns `true` when the viewport width is at or
 * below the Tailwind `sm` breakpoint (< 640px).
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
