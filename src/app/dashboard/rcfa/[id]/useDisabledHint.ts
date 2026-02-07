"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HINT_DISMISS_MS = 2500;

/**
 * Hook for tap-to-reveal disabled button hints on mobile.
 * Shows a hint message when triggered, then auto-dismisses after 2.5 seconds.
 */
export function useDisabledHint(dismissMs = HINT_DISMISS_MS) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    // Reset timer if already showing
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(true);
    timerRef.current = setTimeout(() => setShow(false), dismissMs);
  }, [dismissMs]);

  return { show, trigger };
}
