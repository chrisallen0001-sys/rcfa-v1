"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  type RefObject,
} from "react";

interface PopoverPositionOptions {
  /** Minimum vertical space (px) below anchor to prefer opening downward. */
  spaceThreshold?: number;
  /** Fixed width for the popover. */
  width?: number;
  /** Minimum width for the popover (defaults to anchor width if larger). */
  minWidth?: number;
}

/**
 * Computes fixed-position styles for a popover anchored to a button.
 * Uses useLayoutEffect for the initial position (avoids first-frame flash)
 * and rAF-throttled scroll/resize listeners so the popover tracks its anchor.
 */
export function usePopoverPosition(
  isOpen: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  options: PopoverPositionOptions = {}
): React.CSSProperties {
  const { spaceThreshold = 240, width, minWidth } = options;
  const [style, setStyle] = useState<React.CSSProperties>({});

  const compute = useCallback(() => {
    if (!anchorRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < spaceThreshold;

    const effectiveWidth = width ?? minWidth ?? rect.width;
    const left = Math.min(rect.left, window.innerWidth - effectiveWidth - 8);

    const computed: React.CSSProperties = {
      position: "fixed",
      left: Math.max(8, left),
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 50,
    };

    if (width) {
      computed.width = width;
    } else if (minWidth) {
      computed.minWidth = Math.max(rect.width, minWidth);
    }

    setStyle(computed);
  }, [anchorRef, spaceThreshold, width, minWidth]);

  // Compute position synchronously before paint to avoid a first-frame flash.
  useLayoutEffect(() => {
    if (!isOpen) return;
    compute();
  }, [isOpen, compute]);

  // Recompute on scroll/resize, throttled to one update per animation frame.
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number;
    const throttled = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(compute);
    };

    // Capture phase catches scrolling inside nested containers (e.g. table overflow)
    window.addEventListener("scroll", throttled, true);
    window.addEventListener("resize", throttled);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", throttled, true);
      window.removeEventListener("resize", throttled);
    };
  }, [isOpen, compute]);

  return style;
}
