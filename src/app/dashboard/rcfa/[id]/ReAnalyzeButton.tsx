"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useElapsedTime } from "./useElapsedTime";
import { useDisabledHint } from "./useDisabledHint";

interface ReAnalyzeButtonProps {
  rcfaId: string;
  hasAnsweredQuestions: boolean;
  hasNewAnswers: boolean;
  /** Called before analysis to flush any pending saves */
  onBeforeAnalyze?: () => Promise<void>;
}

function InfoDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const okButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap focus within the dialog
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Use portal to render at document.body level, escaping parent stacking contexts
  // This component is only rendered client-side (inside "use client" module)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="mx-4 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900 sm:mx-0"
      >
        <h2
          id={titleId}
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {title}
        </h2>
        <div className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {children}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            ref={okButtonRef}
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type DialogState =
  | { kind: "none" }
  | { kind: "noChange" }
  | { kind: "materialChange"; reasoning: string };

export default function ReAnalyzeButton({
  rcfaId,
  hasAnsweredQuestions,
  hasNewAnswers,
  onBeforeAnalyze,
}: ReAnalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>({ kind: "none" });
  const pendingRef = useRef(false);
  const elapsed = useElapsedTime(loading);
  const disabledHint = useDisabledHint();

  function handleButtonClick() {
    // If disabled, show hint on tap (mobile has no hover)
    if (!hasNewAnswers) {
      disabledHint.trigger();
      return;
    }
    handleReAnalyze();
  }

  async function handleReAnalyze() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Flush any pending answer saves before analyzing
      if (onBeforeAnalyze) {
        await onBeforeAnalyze();
      }

      const res = await fetch(`/api/rcfa/${rcfaId}/reanalyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to re-analyze");
      }

      const data = await res.json();

      if (data.noMaterialChange) {
        setDialogState({ kind: "noChange" });
      } else if (data.materialityReasoning) {
        setDialogState({ kind: "materialChange", reasoning: data.materialityReasoning });
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  const handleDialogClose = useCallback(() => {
    setDialogState({ kind: "none" });
    router.refresh();
  }, [router]);

  const disabledHintText = !hasAnsweredQuestions
    ? "Answer questions first"
    : "No new answers";

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleButtonClick}
          disabled={loading}
          aria-disabled={!hasNewAnswers}
          title={
            !hasAnsweredQuestions
              ? "Answer at least one follow-up question before re-analyzing"
              : !hasNewAnswers
                ? "No new or updated answers since the last re-analysis"
                : undefined
          }
          className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
            !hasNewAnswers
              ? "cursor-not-allowed bg-blue-600/50 dark:bg-blue-500/50"
              : "bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Re-Analyzing... {elapsed}s
            </span>
          ) : (
            "Re-Analyze with Answers"
          )}
        </button>
        {/* Tap-to-reveal hint for mobile (desktop has hover tooltips) */}
        {disabledHint.show && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 md:hidden">
            {disabledHintText}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
      {dialogState.kind === "noChange" && (
        <InfoDialog title="No Material Change" onClose={handleDialogClose}>
          No material change detected. The new information does not significantly
          alter the identified failure mechanisms, and the current root causes
          and action items remain valid.
        </InfoDialog>
      )}
      {dialogState.kind === "materialChange" && (
        <InfoDialog title="Material Change Identified" onClose={handleDialogClose}>
          {dialogState.reasoning}
        </InfoDialog>
      )}
    </>
  );
}
