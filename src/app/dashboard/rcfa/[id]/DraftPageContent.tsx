"use client";

import { type ReactNode } from "react";
import { DraftNavigationProvider } from "./DraftNavigationContext";
import GuardedBackLink from "./GuardedBackLink";
import ChevronLeftIcon from "@/components/ChevronLeftIcon";

interface DraftPageContentProps {
  /** Full page content including the form */
  children: ReactNode;
}

/**
 * Wraps draft page content with navigation guard context.
 * Provides a guarded back link that warns about unsaved changes.
 */
export default function DraftPageContent({ children }: DraftPageContentProps) {
  return (
    <DraftNavigationProvider>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4">
          <GuardedBackLink
            href="/dashboard"
            className="inline-flex items-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Back to Dashboard"
          >
            <ChevronLeftIcon />
          </GuardedBackLink>
        </div>
        {children}
      </div>
    </DraftNavigationProvider>
  );
}
