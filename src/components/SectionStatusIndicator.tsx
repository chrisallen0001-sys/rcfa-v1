"use client";

export type SectionStatus = "complete" | "required" | "optional" | "review" | "none";

interface SectionStatusIndicatorProps {
  status: SectionStatus;
  /** Show label text next to the icon */
  showLabel?: boolean;
}

/**
 * Displays a status indicator for workflow guidance.
 * Used in collapsible sections during investigation phase.
 */
export default function SectionStatusIndicator({
  status,
  showLabel = true,
}: SectionStatusIndicatorProps) {
  if (status === "none") {
    return null;
  }

  const config = {
    complete: {
      icon: "✅",
      label: "Complete",
      className: "text-green-600 dark:text-green-500",
      bgClassName: "bg-green-100 dark:bg-green-900/30",
    },
    required: {
      icon: "⚠️",
      label: "Required",
      className: "text-amber-600 dark:text-amber-500",
      bgClassName: "bg-amber-100 dark:bg-amber-900/30",
    },
    optional: {
      icon: "💡",
      label: "Optional",
      className: "text-zinc-500 dark:text-zinc-400",
      bgClassName: "bg-zinc-100 dark:bg-zinc-800",
    },
    review: {
      icon: "🔍",
      label: "Review",
      className: "text-purple-600 dark:text-purple-400",
      bgClassName: "bg-purple-100 dark:bg-purple-900/30",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClassName} ${config.className}`}
      role="status"
      aria-label={`Section status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
