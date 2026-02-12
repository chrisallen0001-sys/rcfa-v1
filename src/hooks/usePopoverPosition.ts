"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";

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
 * Recalculates on scroll (capture phase) and resize so the popover
 * follows its anchor when the page or a scrollable container moves.
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

  useEffect(() => {
    if (!isOpen) return;

    compute();

    // Capture phase catches scrolling inside nested containers (e.g. table overflow)
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [isOpen, compute]);

  return style;
}
