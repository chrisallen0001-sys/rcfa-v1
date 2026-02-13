"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useIsMobile } from "@/hooks/useMediaQuery";

interface ActionItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

export default function ActionItemDrawer({
  open,
  onOpenChange,
  title,
  children,
}: ActionItemDrawerProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 data-[state=closed]:ease-in data-[state=open]:ease-out"
        />

        {/* Drawer content */}
        <Dialog.Content
          className={[
            "fixed z-50 flex flex-col bg-white shadow-xl outline-none dark:bg-zinc-900",
            "transition-transform duration-300",
            "data-[state=closed]:ease-in data-[state=open]:ease-out",
            isMobile
              ? [
                  "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl",
                  "data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
                ].join(" ")
              : [
                  "right-0 top-0 h-dvh w-full max-w-lg",
                  "data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
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
              <CloseIcon />
            </Dialog.Close>
          </header>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
