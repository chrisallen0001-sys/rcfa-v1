"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const HINT_DISMISS_MS = 2500;

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
  const [error, setError] = useState<string | null>(null);
  const [showDisabledHint, setShowDisabledHint] = useState(false);
  const pendingRef = useRef(false);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear hint timer on unmount
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  function handleButtonClick() {
    // If disabled, show hint on tap (mobile has no hover)
    if (!hasActionItems) {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      setShowDisabledHint(true);
      hintTimerRef.current = setTimeout(() => {
        setShowDisabledHint(false);
      }, HINT_DISMISS_MS);
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
        throw new Error(data.error ?? "Failed to finalize investigation");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to finalize investigation"
      );
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
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
      {/* Tap-to-reveal hint for mobile (no hover available) */}
      {showDisabledHint && (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Add action items first
        </span>
      )}
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
