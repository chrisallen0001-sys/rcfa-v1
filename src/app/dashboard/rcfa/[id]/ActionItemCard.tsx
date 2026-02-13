"use client";

import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import {
  formatActionItemNumber,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
} from "@/lib/rcfa-utils";

interface ActionItemCardProps {
  actionItemNumber: number;
  actionText: string;
  priority: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
  onClick: () => void;
}

/**
 * Formats a date string (ISO or YYYY-MM-DD) into a compact display form
 * such as "Feb 11, 2026". Returns null if the input is null or invalid.
 */
function formatDateShort(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ActionItemCard({
  actionItemNumber,
  actionText,
  priority,
  status,
  dueDate,
  ownerName,
  onClick,
}: ActionItemCardProps) {
  const priorityKey = priority as Priority;
  const statusKey = status as ActionItemStatus;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
    >
      {/* Row 1: AI number, owner, due date, badges */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {formatActionItemNumber(actionItemNumber)}
        </span>

        {ownerName && (
          <span className="max-w-[10rem] truncate text-xs text-zinc-500 dark:text-zinc-400">
            {ownerName}
          </span>
        )}

        {dueDate && (
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {formatDateShort(dueDate)}
          </span>
        )}

        {/* Spacer pushes badges to the right on wider screens */}
        <span className="flex-1" />

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            PRIORITY_COLORS[priorityKey] ?? ""
          }`}
        >
          {PRIORITY_LABELS[priorityKey] ?? priority}
        </span>

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            ACTION_STATUS_COLORS[statusKey] ?? ""
          }`}
        >
          {ACTION_STATUS_LABELS[statusKey] ?? status}
        </span>
      </div>

      {/* Row 2: Action item title - single line truncate */}
      <p
        className="mt-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
        title={actionText}
      >
        {actionText}
      </p>
    </button>
  );
}
