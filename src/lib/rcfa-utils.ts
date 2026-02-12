import type { RcfaStatus, OperatingContext, Priority, ActionItemStatus, QuestionCategory } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Formats a value as USD currency. Returns null if the value is null,
 * undefined, or not a valid number.
 */
export function formatUsd(value: unknown): string | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : usdFormatter.format(num);
}

/**
 * UI labels for operating context values.
 */
export const OPERATING_CONTEXT_LABELS: Record<OperatingContext, string> = {
  running: "Running",
  startup: "Startup",
  shutdown: "Shutdown",
  maintenance: "Maintenance",
  unknown: "Unknown",
};

/**
 * UI labels for follow-up question category values.
 */
export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  failure_mode: "Failure Mode",
  evidence: "Evidence",
  operating_context: "Operating Context",
  maintenance_history: "Maintenance History",
  safety: "Safety",
  other: "Other",
};

/**
 * Valid operating context values for RCFA equipment.
 */
export const VALID_OPERATING_CONTEXTS: OperatingContext[] = [
  "running",
  "startup",
  "shutdown",
  "maintenance",
  "unknown",
];

/**
 * Formats an RCFA number for display.
 * @param rcfaNumber - The numeric RCFA identifier
 * @returns Formatted string like "RCFA-001"
 */
export function formatRcfaNumber(rcfaNumber: number): string {
  return `RCFA-${String(rcfaNumber).padStart(3, "0")}`;
}

/**
 * Formats an action item number for display.
 * @param actionItemNumber - The numeric action item identifier
 * @returns Formatted string like "AI-0001"
 */
export function formatActionItemNumber(actionItemNumber: number): string {
  return `AI-${String(actionItemNumber).padStart(4, "0")}`;
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
 * UI labels for action item priority values.
 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  deprioritized: "Deprioritized",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Tailwind CSS classes for priority badges.
 */
export const PRIORITY_COLORS: Record<Priority, string> = {
  deprioritized: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/**
 * UI labels for action item status values.
 */
export const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Complete",
  canceled: "Canceled",
};

/**
 * Tailwind CSS classes for action item status badges.
 */
export const ACTION_STATUS_COLORS: Record<ActionItemStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  canceled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
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

/**
 * Transitions allowed via the generic PATCH endpoint.
 * Forward transitions (draft→investigation, investigation→actions_open, actions_open→closed)
 * must use their dedicated endpoints which enforce business rules:
 * - /start-investigation: draft → investigation
 * - /finalize: investigation → actions_open (requires root causes)
 * - /close: actions_open → closed (requires action items complete)
 */
export const PATCH_ALLOWED_TRANSITIONS: Record<RcfaStatus, RcfaStatus[]> = {
  draft: [],                        // Use /start-investigation
  investigation: ["draft"],         // Back only; use /finalize to go forward
  actions_open: ["investigation"],  // Back only; use /close to go forward
  closed: ["actions_open"],         // Reopen allowed via PATCH
};

/**
 * All valid RCFA status values.
 */
export const ALL_RCFA_STATUSES = Object.keys(VALID_STATUS_TRANSITIONS) as RcfaStatus[];

export type StatusTransitionResult =
  | { valid: true }
  | { valid: false; error: string; allowedTransitions: RcfaStatus[] };

/**
 * Validates whether a status transition is allowed.
 * @param from - Current status
 * @param to - Target status
 * @param transitionMap - Optional custom transition map (defaults to VALID_STATUS_TRANSITIONS)
 * @returns Validation result with error message if invalid
 */
export function validateStatusTransition(
  from: RcfaStatus,
  to: RcfaStatus,
  transitionMap: Record<RcfaStatus, RcfaStatus[]> = VALID_STATUS_TRANSITIONS
): StatusTransitionResult {
  if (from === to) {
    return { valid: true };
  }

  const allowed = transitionMap[from];

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

/**
 * Truncates action item title text with ellipsis if it exceeds the maximum length.
 * @param text - The title text to truncate
 * @param maxLength - Maximum length before truncation (default: 90)
 * @returns Truncated text with ellipsis or original text if under limit
 */
export function truncateTitle(text: string, maxLength = 90): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Due date display information including human-readable text and color styling.
 */
export type DueDateInfo = {
  text: string;
  colorClass: string;
};

/**
 * Calculates the number of days between today and a due date.
 * Returns null if date is null.
 */
function getDueDateDiffDays(date: Date | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formats a due date for display with human-readable text and appropriate color styling.
 * @param date - The due date to format (can be null)
 * @returns Object with text and colorClass for styling
 */
export function formatDueDateWithColor(date: Date | null): DueDateInfo {
  const diffDays = getDueDateDiffDays(date);

  if (diffDays === null) {
    return {
      text: "No due date",
      colorClass: "text-zinc-500 dark:text-zinc-400",
    };
  }

  let text: string;
  let colorClass: string;

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    text = `Overdue by ${absDays} day${absDays !== 1 ? "s" : ""}`;
    colorClass = "text-red-600 dark:text-red-400 font-medium";
  } else if (diffDays === 0) {
    text = "Due today";
    colorClass = "text-amber-600 dark:text-amber-400";
  } else if (diffDays === 1) {
    text = "Due tomorrow";
    colorClass = "text-amber-600 dark:text-amber-400";
  } else if (diffDays <= 2) {
    text = `Due in ${diffDays} days`;
    colorClass = "text-amber-600 dark:text-amber-400";
  } else if (diffDays <= 7) {
    text = `Due in ${diffDays} days`;
    colorClass = "text-zinc-500 dark:text-zinc-400";
  } else {
    const dueDate = new Date(date!);
    text = `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    colorClass = "text-zinc-500 dark:text-zinc-400";
  }

  return { text, colorClass };
}
