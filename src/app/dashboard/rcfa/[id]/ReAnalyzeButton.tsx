"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useElapsedTime } from "./useElapsedTime";

interface ReAnalyzeButtonProps {
  rcfaId: string;
  hasAnsweredQuestions: boolean;
  hasNewAnswers: boolean;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
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
    </div>
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
}: ReAnalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>({ kind: "none" });
  const pendingRef = useRef(false);
  const elapsed = useElapsedTime(loading);

  async function handleReAnalyze() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
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

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={handleReAnalyze}
          disabled={loading || !hasNewAnswers}
          title={
            !hasAnsweredQuestions
              ? "Answer at least one follow-up question before re-analyzing"
              : !hasNewAnswers
                ? "No new or updated answers since the last re-analysis"
                : undefined
          }
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
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
        {/* Mobile-only hint when disabled (no hover on mobile) */}
        {!hasNewAnswers && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 md:hidden">
            {!hasAnsweredQuestions
              ? "Answer questions first"
              : "No new answers"}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
      {dialogState.kind === "noChange" && (
        <InfoDialog title="No Material Change" onClose={handleDialogClose}>
          The additional information provided does not materially change the
          evidence supporting the current top root cause contenders or associated
          action items. Based on the available data, the existing root causes
          remain the most defensible explanation of the failure mechanism and
          contributing factors. Click OK to acknowledge and continue, or provide
          additional evidence if you believe a different conclusion is warranted.
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
