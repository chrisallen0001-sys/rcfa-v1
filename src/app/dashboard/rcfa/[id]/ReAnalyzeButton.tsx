"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useElapsedTime } from "./useElapsedTime";

interface ReAnalyzeButtonProps {
  rcfaId: string;
  hasAnsweredQuestions: boolean;
  hasNewAnswers: boolean;
}

export default function ReAnalyzeButton({
  rcfaId,
  hasAnsweredQuestions,
  hasNewAnswers,
}: ReAnalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleReAnalyze}
        disabled={loading || !hasNewAnswers}
        title={
          !hasAnsweredQuestions
            ? "Answer at least one follow-up question before re-analyzing"
            : !hasNewAnswers
              ? "No new or updated answers since the last re-analysis."
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
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
