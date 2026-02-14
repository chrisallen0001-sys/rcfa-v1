"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisabledHint } from "./useDisabledHint";
import { formatActionItemNumber, truncateTitle } from "@/lib/rcfa-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IncompleteItem {
  actionItemNumber: number;
  actionText: string;
  missingFields: string[];
}

type FinalizeError =
  | { kind: "generic"; message: string }
  | { kind: "incomplete"; items: IncompleteItem[] };

// ---------------------------------------------------------------------------
// Field name mapping — raw API field names to human-readable labels
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  actionText: "Action Title",
  actionDescription: "Description",
  ownerUserId: "Owner",
  dueDate: "Due Date",
  priority: "Priority",
};

function humanFieldName(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Max incomplete items to show before collapsing with "and N more". */
const MAX_DISPLAYED_ITEMS = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FinalizeInvestigationButtonProps {
  rcfaId: string;
  totalActionItems: number;
}

export default function FinalizeInvestigationButton({
  rcfaId,
  totalActionItems,
}: FinalizeInvestigationButtonProps) {
  const hasActionItems = totalActionItems > 0;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FinalizeError | null>(null);
  const pendingRef = useRef(false);
  const disabledHint = useDisabledHint();

  function handleButtonClick() {
    // If disabled, show hint on tap (mobile has no hover)
    if (!hasActionItems) {
      disabledHint.trigger();
      return;
    }
    handleClick();
  }

  async function handleClick() {
    if (pendingRef.current) return;
    const ok = window.confirm(
      "Finalize investigation? This will move the RCFA to Action Items in Progress and lock root cause editing."
    );
    if (!ok) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rcfa/${rcfaId}/finalize`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        // Structured validation error — incomplete draft action items
        if (Array.isArray(data.incompleteItems) && data.incompleteItems.length > 0) {
          setError({ kind: "incomplete", items: data.incompleteItems });
          return;
        }

        throw new Error(data.error ?? "Failed to finalize investigation");
      }

      router.refresh();
    } catch (err) {
      setError({
        kind: "generic",
        message:
          err instanceof Error
            ? err.message
            : "Failed to finalize investigation",
      });
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleButtonClick}
          disabled={loading}
          aria-disabled={!hasActionItems}
          title={
            hasActionItems
              ? "Lock root causes and move to action item tracking"
              : "Add at least one action item before finalizing"
          }
          className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
            !hasActionItems
              ? "cursor-not-allowed bg-amber-600/50 dark:bg-amber-500/50"
              : "bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Finalizing...
            </span>
          ) : (
            "Finalize Investigation"
          )}
        </button>
        {/* Tap-to-reveal hint for mobile (desktop has hover tooltips) */}
        {disabledHint.show && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 md:hidden">
            Add action items first
          </span>
        )}
        {/* Generic (non-validation) error — inline message */}
        {error?.kind === "generic" && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </span>
        )}
      </div>

      {/* Structured validation error — incomplete action items list */}
      {error?.kind === "incomplete" && (
        <IncompleteItemsBanner items={error.items} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incomplete items banner
// ---------------------------------------------------------------------------

function IncompleteItemsBanner({ items }: { items: IncompleteItem[] }) {
  const displayed = items.slice(0, MAX_DISPLAYED_ITEMS);
  const remaining = items.length - displayed.length;

  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/40"
    >
      <p className="mb-2 font-medium text-amber-800 dark:text-amber-300">
        Cannot finalize investigation — the following action items are missing
        required fields:
      </p>
      <ul className="list-inside space-y-1 text-amber-700 dark:text-amber-400">
        {displayed.map((item) => (
          <li key={item.actionItemNumber}>
            <span className="font-semibold">
              {formatActionItemNumber(item.actionItemNumber)}
            </span>{" "}
            <span className="text-amber-600 dark:text-amber-500">
              &ldquo;{truncateTitle(item.actionText, 60)}&rdquo;
            </span>
            : Missing{" "}
            <span className="font-medium">
              {item.missingFields.map(humanFieldName).join(", ")}
            </span>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <p className="mt-2 text-amber-600 dark:text-amber-500">
          ...and {remaining} more incomplete{" "}
          {remaining === 1 ? "item" : "items"}.
        </p>
      )}
    </div>
  );
}
