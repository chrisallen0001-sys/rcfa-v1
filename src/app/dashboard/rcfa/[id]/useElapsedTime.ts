"use client";

import { useEffect, useState } from "react";

/**
 * Hook that tracks elapsed time in seconds while a loading state is active.
 * Returns 0 when not loading.
 *
 * Note: On the first frame of a new loading session, there may be a brief
 * flash of the previous elapsed value before resetting to 0. This is
 * imperceptible in practice due to React's batching.
 */
export function useElapsedTime(loading: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) {
      return;
    }

    // Capture start time when effect runs
    const startTime = Date.now();

    // Reset elapsed to 0 immediately for this session
    const initialTimeout = setTimeout(() => {
      setElapsed(0);
    }, 0);

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [loading]);

  return loading ? elapsed : 0;
}
