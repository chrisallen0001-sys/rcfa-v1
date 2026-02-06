import type { RcfaStatus } from "@/generated/prisma/client";

/**
 * Formats an RCFA number for display.
 * @param rcfaNumber - The numeric RCFA identifier
 * @returns Formatted string like "RCFA-001"
 */
export function formatRcfaNumber(rcfaNumber: number): string {
  return `RCFA-${String(rcfaNumber).padStart(3, "0")}`;
}

/**
 * UI labels for RCFA status values.
 */
export const RCFA_STATUS_LABELS: Record<RcfaStatus, string> = {
  draft: "In Draft",
  investigation: "Investigation",
  actions_open: "Action Items in Progress",
  closed: "Closed",
};

/**
 * Tailwind CSS classes for RCFA status badges.
 */
export const RCFA_STATUS_COLORS: Record<RcfaStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  investigation:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  actions_open:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
