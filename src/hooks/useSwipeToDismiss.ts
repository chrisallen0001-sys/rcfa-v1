"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Threshold in pixels: if the user swipes down past this distance, dismiss.
 * Also dismisses at 30% of the element height, whichever is smaller.
 */
const DISMISS_PX = 100;
const DISMISS_RATIO = 0.3;

interface SwipeToDismissOptions {
  /** Whether the swipe gesture is enabled (should be false on desktop). */
  enabled: boolean;
  /** Called when the swipe exceeds the dismiss threshold. */
  onDismiss: () => void;
  /**
   * Optional callback to sync backdrop opacity with the swipe position.
   * Receives a value from 1 (fully visible) to 0 (fully dismissed).
   */
  onOpacityChange?: (opacity: number) => void;
}

interface SwipeState {
  /** Whether we are actively tracking a swipe gesture. */
  tracking: boolean;
  /** The initial Y coordinate of the touch. */
  startY: number;
  /** Current translateY offset applied to the element. */
  currentY: number;
  /** Whether we decided this gesture is not a swipe (e.g. scrolling content). */
  rejected: boolean;
}

/**
 * Hook that enables swipe-to-dismiss on a mobile bottom sheet.
 *
 * Uses refs and direct DOM manipulation for performance (no setState on
 * every touchmove). Only tracks downward swipes. Uses a heuristic to avoid
 * interfering with content scrolling: the swipe is only tracked if the touch
 * starts on the drag handle area (first 44px of the element) or if the
 * scrollable content is at the top (scrollTop === 0).
 *
 * @returns A ref to attach to the swipeable element.
 */
export function useSwipeToDismiss({
  enabled,
  onDismiss,
  onOpacityChange,
}: SwipeToDismissOptions): React.RefCallback<HTMLElement> {
  const stateRef = useRef<SwipeState>({
    tracking: false,
    startY: 0,
    currentY: 0,
    rejected: false,
  });

  // Keep callbacks in refs so we don't re-attach listeners when they change.
  const onDismissRef = useRef(onDismiss);
  const onOpacityChangeRef = useRef(onOpacityChange);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    onOpacityChangeRef.current = onOpacityChange;
  }, [onOpacityChange]);

  // The element we attached listeners to (tracked for cleanup).
  const elementRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = elementRef.current;
    if (!el) return;

    const touch = e.touches[0];
    const rect = el.getBoundingClientRect();
    const touchRelativeY = touch.clientY - rect.top;

    // Heuristic: only start tracking if the touch is in the drag handle
    // area (top 44px) or if the scrollable content is scrolled to the top.
    const scrollableContent = el.querySelector("[data-scroll-region]") as HTMLElement | null;
    const isAtScrollTop = !scrollableContent || scrollableContent.scrollTop <= 0;
    const isInDragHandle = touchRelativeY <= 44;

    if (!isInDragHandle && !isAtScrollTop) {
      stateRef.current = { tracking: false, startY: 0, currentY: 0, rejected: true };
      return;
    }

    stateRef.current = {
      tracking: true,
      startY: touch.clientY,
      currentY: 0,
      rejected: false,
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = stateRef.current;
    if (state.rejected || !state.tracking) return;

    const el = elementRef.current;
    if (!el) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - state.startY;

    // Only track downward swipes.
    if (deltaY < 0) {
      state.currentY = 0;
      el.style.transform = "";
      onOpacityChangeRef.current?.(1);
      return;
    }

    // Prevent scroll while swiping
    e.preventDefault();

    state.currentY = deltaY;
    el.style.transform = `translateY(${deltaY}px)`;
    // Remove the CSS animation while dragging to avoid conflicts
    el.style.animation = "none";

    // Sync backdrop opacity: from 1 at 0px to 0 at the dismiss threshold.
    const height = el.offsetHeight;
    const threshold = Math.min(DISMISS_PX, height * DISMISS_RATIO);
    const progress = Math.min(deltaY / threshold, 1);
    onOpacityChangeRef.current?.(1 - progress * 0.5);
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = stateRef.current;
    const el = elementRef.current;

    if (state.rejected || !state.tracking || !el) {
      stateRef.current = { tracking: false, startY: 0, currentY: 0, rejected: false };
      return;
    }

    const height = el.offsetHeight;
    const threshold = Math.min(DISMISS_PX, height * DISMISS_RATIO);

    if (state.currentY >= threshold) {
      // Dismiss: animate the rest of the way off-screen, then call onDismiss.
      el.style.transition = "transform 200ms ease-in";
      el.style.transform = `translateY(${height}px)`;
      onOpacityChangeRef.current?.(0);

      const cleanup = () => {
        el.removeEventListener("transitionend", cleanup);
        el.style.transform = "";
        el.style.transition = "";
        el.style.animation = "";
        onDismissRef.current();
      };
      el.addEventListener("transitionend", cleanup, { once: true });

      // Safety timeout in case transitionend doesn't fire.
      setTimeout(() => {
        cleanup();
      }, 300);
    } else {
      // Snap back to original position.
      el.style.transition = "transform 200ms ease-out";
      el.style.transform = "";
      onOpacityChangeRef.current?.(1);

      const cleanup = () => {
        el.removeEventListener("transitionend", cleanup);
        el.style.transition = "";
        el.style.animation = "";
      };
      el.addEventListener("transitionend", cleanup, { once: true });
      setTimeout(() => {
        cleanup();
      }, 300);
    }

    stateRef.current = { tracking: false, startY: 0, currentY: 0, rejected: false };
  }, []);

  // Use a ref callback so we can attach/detach listeners when the element mounts/unmounts.
  const refCallback = useCallback(
    (node: HTMLElement | null) => {
      // Clean up previous element
      const prev = elementRef.current;
      if (prev) {
        prev.style.transform = "";
        prev.style.transition = "";
        prev.style.animation = "";
        prev.removeEventListener("touchstart", handleTouchStart);
        prev.removeEventListener("touchmove", handleTouchMove);
        prev.removeEventListener("touchend", handleTouchEnd);
      }

      elementRef.current = node;

      if (node && enabled) {
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
        node.addEventListener("touchmove", handleTouchMove, { passive: false });
        node.addEventListener("touchend", handleTouchEnd, { passive: true });
      }
    },
    [enabled, handleTouchStart, handleTouchMove, handleTouchEnd],
  );

  return refCallback;
}
