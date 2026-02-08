"use client";

import { type ReactNode } from "react";
import { DraftNavigationProvider } from "./DraftNavigationContext";
import GuardedBackLink from "./GuardedBackLink";

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
        <div className="mb-2">
          <GuardedBackLink
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; Dashboard
          </GuardedBackLink>
        </div>
        {children}
      </div>
    </DraftNavigationProvider>
  );
}
