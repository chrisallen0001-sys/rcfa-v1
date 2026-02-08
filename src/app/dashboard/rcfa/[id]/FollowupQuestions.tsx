"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { QuestionCategory } from "@/generated/prisma/client";

export interface FollowupQuestionsHandle {
  flushPendingSaves: () => Promise<void>;
}

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  failure_mode: "Failure Mode",
  evidence: "Evidence",
  operating_context: "Operating Context",
  maintenance_history: "Maintenance History",
  safety: "Safety",
  other: "Other",
};

const DEBOUNCE_MS = 2000;

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface FollowupQuestion {
  id: string;
  questionText: string;
  questionCategory: QuestionCategory;
  answerText: string | null;
  answeredAt: string | null;
  answeredBy: { email: string } | null;
}

interface FollowupQuestionsProps {
  rcfaId: string;
  questions: FollowupQuestion[];
  isInvestigation: boolean;
}

interface QuestionCardHandle {
  /** Flushes pending saves. Throws if save fails. */
  flush: () => Promise<void>;
}

interface QuestionCardProps {
  rcfaId: string;
  question: FollowupQuestion;
  index: number;
  isInvestigation: boolean;
  onDirtyChange: (questionId: string, isDirty: boolean) => void;
}

const QuestionCard = forwardRef<QuestionCardHandle, QuestionCardProps>(
  function QuestionCard(
    { rcfaId, question, index, isInvestigation, onDirtyChange },
    ref
  ) {
    const router = useRouter();
    const [answerText, setAnswerText] = useState(question.answerText ?? "");
    const [savedAnswer, setSavedAnswer] = useState(question.answerText);
    const [savedAt, setSavedAt] = useState(question.answeredAt);
    const [savedByEmail, setSavedByEmail] = useState(
      question.answeredBy?.email ?? null
    );
    const [status, setStatus] = useState<SaveStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const savePromiseRef = useRef<Promise<void> | null>(null);
    const lastSaveErrorRef = useRef<string | null>(null);
    const answerTextRef = useRef(answerText);
    answerTextRef.current = answerText;

    const isDirty = answerText.trim() !== (savedAnswer ?? "");

    // Notify parent of dirty state changes
    useEffect(() => {
      onDirtyChange(question.id, isDirty || status === "pending" || status === "saving");
    }, [isDirty, status, question.id, onDirtyChange]);

    const save = useCallback(
      async (textToSave: string): Promise<void> => {
        const trimmed = textToSave.trim();
        if (!trimmed) return;

        // Abort any in-flight request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setStatus("saving");
        setError(null);
        lastSaveErrorRef.current = null;

        try {
          const res = await fetch(
            `/api/rcfa/${rcfaId}/followup-questions/${question.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ answerText: trimmed }),
              signal: abortControllerRef.current.signal,
            }
          );

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Failed to save");
          }

          const updated = await res.json();
          setSavedAnswer(updated.answerText);
          setSavedAt(updated.answeredAt);
          setSavedByEmail(updated.answeredBy?.email ?? null);
          setStatus("saved");
          router.refresh();
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            // Request was aborted - clear promise ref since it's no longer valid
            savePromiseRef.current = null;
            return;
          }
          const errorMessage = err instanceof Error ? err.message : "Failed to save answer";
          setError(errorMessage);
          setStatus("error");
          lastSaveErrorRef.current = errorMessage;
        }
      },
      [rcfaId, question.id, router]
    );

    // Expose flush method to parent via ref
    useImperativeHandle(ref, () => ({
      flush: async () => {
        // Clear debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        // If we have pending changes, start save immediately
        const trimmed = answerTextRef.current.trim();
        const trimmedSaved = savedAnswer ?? "";
        if (trimmed && trimmed !== trimmedSaved) {
          savePromiseRef.current = save(answerTextRef.current);
        }

        // Wait for any in-flight or just-started save to complete
        if (savePromiseRef.current) {
          await savePromiseRef.current;
        }

        // Propagate save errors to caller
        if (lastSaveErrorRef.current) {
          throw new Error(lastSaveErrorRef.current);
        }
      },
    }), [save, savedAnswer]);

    const handleChange = useCallback(
      (newValue: string) => {
        setAnswerText(newValue);

        // Clear any existing debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        const trimmedNew = newValue.trim();
        const trimmedSaved = savedAnswer ?? "";

        // Only schedule save if there's actual change and non-empty content
        if (trimmedNew && trimmedNew !== trimmedSaved) {
          setStatus("pending");
          debounceTimerRef.current = setTimeout(() => {
            savePromiseRef.current = save(newValue);
          }, DEBOUNCE_MS);
        } else if (!trimmedNew || trimmedNew === trimmedSaved) {
          setStatus("idle");
        }
      },
      [savedAnswer, save]
    );

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, []);

    const retryHandler = useCallback(() => {
      save(answerText);
    }, [save, answerText]);

    function renderStatusIndicator() {
      switch (status) {
        case "pending":
          return (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          );
        case "saving":
          return (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Saving...
            </span>
          );
        case "saved":
          return (
            <span className="text-xs text-green-600 dark:text-green-400">
              Saved
            </span>
          );
        case "error":
          return (
            <span className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              {error ?? "Failed to save"}
              <button
                onClick={retryHandler}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </span>
          );
        default:
          return null;
      }
    }

    return (
      <div className="rounded-md border border-zinc-100 p-4 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {index + 1}. {question.questionText}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {CATEGORY_LABELS[question.questionCategory] ?? question.questionCategory}
          </span>
        </div>

        {isInvestigation ? (
          <>
            <div className="mt-3">
              <textarea
                value={answerText}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Type your answer..."
                maxLength={10000}
                rows={3}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {savedAt && savedByEmail && (
                  <span>
                    Answered by {savedByEmail} on{" "}
                    {new Date(savedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {renderStatusIndicator()}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3">
            {savedAnswer ? (
              <>
                <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                  {savedAnswer}
                </p>
                {savedAt && savedByEmail && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Answered by {savedByEmail} on{" "}
                    {new Date(savedAt).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                No answer provided
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

const FollowupQuestions = forwardRef<FollowupQuestionsHandle, FollowupQuestionsProps>(
  function FollowupQuestions({ rcfaId, questions, isInvestigation }, ref) {
    const [dirtyQuestions, setDirtyQuestions] = useState<Set<string>>(new Set());
    const cardRefsRef = useRef<Map<string, QuestionCardHandle>>(new Map());

    const handleDirtyChange = useCallback(
      (questionId: string, isDirty: boolean) => {
        setDirtyQuestions((prev) => {
          const next = new Set(prev);
          if (isDirty) {
            next.add(questionId);
          } else {
            next.delete(questionId);
          }
          return next;
        });
      },
      []
    );

    // Expose flushPendingSaves to parent via ref
    useImperativeHandle(ref, () => ({
      flushPendingSaves: async () => {
        const flushPromises: Promise<void>[] = [];
        cardRefsRef.current.forEach((cardRef) => {
          flushPromises.push(cardRef.flush());
        });
        await Promise.all(flushPromises);
      },
    }), []);

    // Navigation guard: warn user about unsaved changes
    useEffect(() => {
      if (!isInvestigation) return;

      const hasUnsaved = dirtyQuestions.size > 0;

      function handleBeforeUnload(e: BeforeUnloadEvent) {
        if (hasUnsaved) {
          e.preventDefault();
        }
      }

      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [dirtyQuestions, isInvestigation]);

    const setCardRef = useCallback((questionId: string, handle: QuestionCardHandle | null) => {
      if (handle) {
        cardRefsRef.current.set(questionId, handle);
      } else {
        cardRefsRef.current.delete(questionId);
      }
    }, []);

    return (
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            ref={(handle) => setCardRef(q.id, handle)}
            rcfaId={rcfaId}
            question={q}
            index={i}
            isInvestigation={isInvestigation}
            onDirtyChange={handleDirtyChange}
          />
        ))}
      </div>
    );
  }
);

export default FollowupQuestions;
