"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const SSR_SNAPSHOT = () => false;

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
  const mql = useMemo(
    () => (typeof window !== "undefined" ? window.matchMedia(query) : null),
    [query],
  );

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!mql) return () => {};
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [mql],
  );

  const getSnapshot = useCallback(() => {
    return mql?.matches ?? false;
  }, [mql]);

  return useSyncExternalStore(subscribe, getSnapshot, SSR_SNAPSHOT);
}

/**
 * Convenience hook that returns `true` when the viewport width is below
 * the Tailwind `sm` breakpoint (< 640px).
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
