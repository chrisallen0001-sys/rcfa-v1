"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
import { useElapsedTime } from "./useElapsedTime";
import ReAnalyzeButton from "./ReAnalyzeButton";
import FinalizeInvestigationButton from "./FinalizeInvestigationButton";
import BackToInvestigationButton from "./BackToInvestigationButton";
import CloseRcfaButton from "./CloseRcfaButton";
import ReopenRcfaButton from "./ReopenRcfaButton";

type RcfaStatus = "draft" | "investigation" | "actions_open" | "closed";

/** Fields required before starting investigation */
type RequiredField = "title" | "equipmentDescription" | "failureDescription";

/** Human-readable labels for required fields */
const FIELD_LABELS: Record<RequiredField, string> = {
  title: "Title",
  equipmentDescription: "Equipment Description",
  failureDescription: "Failure Description",
};

interface RcfaActionBarProps {
  rcfaId: string;
  status: RcfaStatus;
  canEdit: boolean;
  isAdmin: boolean;
  // For draft state
  onSaveForm?: () => Promise<boolean>;
  /** List of required fields that are missing (draft state only) */
  missingRequiredFields?: RequiredField[];
  // For investigation/actions_open state
  hasAnsweredQuestions?: boolean;
  hasNewDataForReanalysis?: boolean;
  /** Called before re-analyze to flush pending answer saves */
  onFlushAnswers?: () => Promise<void>;
  // For actions_open state
  allActionItemsComplete?: boolean;
  totalActionItems?: number;
}

function AnalyzeWithAIButton({
  rcfaId,
  onSaveForm,
  disabled,
  disabledReason,
}: {
  rcfaId: string;
  onSaveForm?: () => Promise<boolean>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const elapsed = useElapsedTime(loading);

  async function handleClick() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Save form first if callback provided
      if (onSaveForm) {
        const saved = await onSaveForm();
        if (!saved) {
          setError("Failed to save form before analyzing");
          return;
        }
      }

      const res = await fetch(`/api/rcfa/${rcfaId}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start AI-guided investigation");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start AI-guided investigation");
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        title={disabled && disabledReason ? disabledReason : "AI-guided investigation: AI will generate follow-up questions, root cause candidates, and suggested action items"}
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-400"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Starting AI-Guided Investigation... {elapsed}s
          </span>
        ) : (
          "AI-Guided Investigation"
        )}
      </button>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

function StartWithoutAIButton({
  rcfaId,
  onSaveForm,
  disabled,
  disabledReason,
}: {
  rcfaId: string;
  onSaveForm?: () => Promise<boolean>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function handleClick() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Save form first if callback provided
      if (onSaveForm) {
        const saved = await onSaveForm();
        if (!saved) {
          setError("Failed to save form before starting");
          return;
        }
      }

      const res = await fetch(`/api/rcfa/${rcfaId}/start-investigation`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start investigation");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start investigation");
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        title={disabled && disabledReason ? disabledReason : "Manual investigation: Start investigation without AI suggestions"}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Starting Manual Investigation...
          </span>
        ) : (
          "Manual Investigation"
        )}
      </button>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}

export default function RcfaActionBar({
  rcfaId,
  status,
  canEdit,
  isAdmin,
  onSaveForm,
  missingRequiredFields = [],
  hasAnsweredQuestions = false,
  hasNewDataForReanalysis = false,
  onFlushAnswers,
  allActionItemsComplete = false,
  totalActionItems = 0,
}: RcfaActionBarProps) {
  // Don't render if user can't edit (except closed state where admin can reopen)
  if (!canEdit && !(status === "closed" && isAdmin)) {
    return null;
  }

  // Compute disabled state for draft buttons
  const hasMissingFields = missingRequiredFields.length > 0;
  const disabledReason = hasMissingFields
    ? `Required fields missing: ${missingRequiredFields.map(f => FIELD_LABELS[f]).join(", ")}`
    : undefined;

  const renderButtons = () => {
    switch (status) {
      case "draft":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <AnalyzeWithAIButton
              rcfaId={rcfaId}
              onSaveForm={onSaveForm}
              disabled={hasMissingFields}
              disabledReason={disabledReason}
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
            <StartWithoutAIButton
              rcfaId={rcfaId}
              onSaveForm={onSaveForm}
              disabled={hasMissingFields}
              disabledReason={disabledReason}
            />
          </div>
        );

      case "investigation":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <ReAnalyzeButton
              rcfaId={rcfaId}
              hasAnsweredQuestions={hasAnsweredQuestions}
              hasNewAnswers={hasNewDataForReanalysis}
              onBeforeAnalyze={onFlushAnswers}
            />
            <FinalizeInvestigationButton
              rcfaId={rcfaId}
              totalActionItems={totalActionItems}
            />
          </div>
        );

      case "actions_open":
        return (
          <div className="flex flex-wrap items-center gap-3">
            <ReAnalyzeButton
              rcfaId={rcfaId}
              hasAnsweredQuestions={hasAnsweredQuestions}
              hasNewAnswers={hasNewDataForReanalysis}
              onBeforeAnalyze={onFlushAnswers}
            />
            <BackToInvestigationButton rcfaId={rcfaId} />
            {allActionItemsComplete && <CloseRcfaButton rcfaId={rcfaId} />}
            {!allActionItemsComplete && totalActionItems > 0 && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Complete all action items to close
              </span>
            )}
            {totalActionItems === 0 && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Add action items to close
              </span>
            )}
          </div>
        );

      case "closed":
        if (isAdmin) {
          return <ReopenRcfaButton rcfaId={rcfaId} />;
        }
        return null;

      default:
        return null;
    }
  };

  const buttons = renderButtons();
  if (!buttons) return null;

  // top-16 (64px) positions below AppHeader. Update if header height changes.
  return (
    <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
      {buttons}
    </div>
  );
}
