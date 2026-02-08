"use client";

import { useState, ReactNode } from "react";
import SectionStatusIndicator, {
  type SectionStatus,
} from "./SectionStatusIndicator";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Optional content to render in the header row (e.g., progress bar, badge) */
  headerContent?: ReactNode;
  /** Custom className for the section wrapper */
  className?: string;
  /** Status indicator for workflow guidance (investigation phase only) */
  status?: SectionStatus;
}

export default function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  headerContent,
  className = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
  status,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
      >
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
            {status && <SectionStatusIndicator status={status} />}
          </div>
          {headerContent && (
            <div onClick={(e) => e.stopPropagation()}>{headerContent}</div>
          )}
        </div>
        <svg
          className={`ml-4 h-5 w-5 flex-shrink-0 text-zinc-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {/* Using max-h-[10000px] as a large value to allow content to expand smoothly.
          CSS Grid animation (grid-template-rows: 0fr → 1fr) would be cleaner but requires
          additional markup. This approach is pragmatic for varying content heights. */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 pb-6">{children}</div>
      </div>
    </section>
  );
}
