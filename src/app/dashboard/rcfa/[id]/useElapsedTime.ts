"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook that tracks elapsed time in seconds while a loading state is active.
 * Returns 0 when not loading.
 */
export function useElapsedTime(loading: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!loading) {
      return;
    }

    // Capture start time when effect runs (in callback, not render)
    startTimeRef.current = Date.now();

    // Initial tick to show 0s immediately
    const initialTimeout = setTimeout(() => {
      setElapsed(0);
    }, 0);

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [loading]);

  return loading ? elapsed : 0;
}
