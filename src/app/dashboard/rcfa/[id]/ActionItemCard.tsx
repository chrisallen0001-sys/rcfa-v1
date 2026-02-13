"use client";

import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import {
  formatActionItemNumber,
  formatDateShort,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
} from "@/lib/rcfa-utils";

interface ActionItemCardProps {
  actionItemNumber: number;
  actionText: string;
  priority: Priority;
  status: ActionItemStatus;
  dueDate: string | null;
  ownerName: string | null;
  onClick: () => void;
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${formatActionItemNumber(actionItemNumber)}: ${actionText}`}
      className="w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 dark:focus-visible:ring-blue-400"
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
            PRIORITY_COLORS[priority] ?? ""
          }`}
        >
          {PRIORITY_LABELS[priority] ?? priority}
        </span>

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            ACTION_STATUS_COLORS[status] ?? ""
          }`}
        >
          {ACTION_STATUS_LABELS[status] ?? status}
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
