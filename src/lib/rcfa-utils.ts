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

/**
 * Valid status transitions for RCFA workflow.
 * Key = current status, Value = array of allowed next statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<RcfaStatus, RcfaStatus[]> = {
  draft: ["investigation"],
  investigation: ["draft", "actions_open"],
  actions_open: ["investigation", "closed"],
  closed: ["actions_open"],
};

export type StatusTransitionResult =
  | { valid: true }
  | { valid: false; error: string; allowedTransitions: RcfaStatus[] };

/**
 * Validates whether a status transition is allowed.
 * @param from - Current status
 * @param to - Target status
 * @returns Validation result with error message if invalid
 */
export function validateStatusTransition(
  from: RcfaStatus,
  to: RcfaStatus
): StatusTransitionResult {
  if (from === to) {
    return { valid: true };
  }

  const allowed = VALID_STATUS_TRANSITIONS[from];

  if (allowed.includes(to)) {
    return { valid: true };
  }

  const allowedLabels = allowed.map((s) => RCFA_STATUS_LABELS[s]).join(", ");

  return {
    valid: false,
    error: `Cannot transition from "${RCFA_STATUS_LABELS[from]}" to "${RCFA_STATUS_LABELS[to]}". Allowed transitions: ${allowedLabels || "none"}.`,
    allowedTransitions: allowed,
  };
}
