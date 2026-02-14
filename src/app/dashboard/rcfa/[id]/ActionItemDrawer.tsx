"use client";

import { useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import XIcon from "@/components/XIcon";

interface ActionItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export default function ActionItemDrawer({
  open,
  onOpenChange,
  title,
  children,
}: ActionItemDrawerProps) {
  // SSR-safe: useIsMobile() returns false during SSR, but this component is only
  // rendered inside Dialog.Portal which does not SSR, so no hydration mismatch occurs.
  const isMobile = useIsMobile();

  // Ref to the overlay element so we can sync its opacity during swipe.
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    // Reset any inline opacity the swipe handler may have set on the overlay.
    // Radix unmounts the overlay so this is belt-and-suspenders, but avoids a
    // stale inline style if the component is ever reused without unmounting.
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "";
    }
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpacityChange = useCallback((opacity: number) => {
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(opacity);
    }
  }, []);

  const swipeRef = useSwipeToDismiss({
    enabled: isMobile && open,
    onDismiss: handleDismiss,
    onOpacityChange: handleOpacityChange,
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-[drawer-overlay-fade-in_300ms_ease-out] data-[state=closed]:animate-[drawer-overlay-fade-out_200ms_ease-in] motion-reduce:animate-none motion-reduce:transition-none"
        />

        {/* Drawer content */}
        <Dialog.Content
          ref={isMobile ? swipeRef : undefined}
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("[data-date-picker-portal]")) {
              e.preventDefault();
            }
          }}
          className={[
            "fixed z-[51] flex flex-col bg-white shadow-xl outline-none dark:bg-zinc-900 motion-reduce:animate-none motion-reduce:transition-none",
            isMobile
              ? [
                  "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl",
                  "data-[state=open]:animate-[drawer-slide-in-from-bottom_300ms_ease-out]",
                  "data-[state=closed]:animate-[drawer-slide-out-to-bottom_200ms_ease-in]",
                ].join(" ")
              : [
                  "right-0 top-0 h-dvh w-full max-w-lg",
                  "data-[state=open]:animate-[drawer-slide-in-from-right_300ms_ease-out]",
                  "data-[state=closed]:animate-[drawer-slide-out-to-right_200ms_ease-in]",
                ].join(" "),
          ].join(" ")}
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>
          )}

          {/* Header */}
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <Dialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close"
            >
              <XIcon />
            </Dialog.Close>
          </header>

          {/* Scrollable content area — data-scroll-region used by useSwipeToDismiss.
              overscroll-behavior-y:none prevents iOS Safari's rubber-band bounce from
              interfering with swipe-to-dismiss detection. */}
          <div data-scroll-region className="flex-1 overflow-y-auto overscroll-y-none p-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
