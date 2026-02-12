"use client";

import { useEffect, type RefObject } from "react";

/**
 * Dismisses a popover on outside click (mousedown) or Escape key press.
 *
 * Callers should pass stable references for `onClose` (wrap with useCallback)
 * and `elementRefs` (wrap with useMemo) to avoid unnecessary re-subscriptions.
 */
export function usePopoverDismiss(
  isOpen: boolean,
  onClose: () => void,
  elementRefs: RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (elementRefs.every((ref) => !ref.current?.contains(target))) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, elementRefs]);
}
