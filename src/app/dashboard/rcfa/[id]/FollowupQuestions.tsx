"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FollowupQuestion {
  id: string;
  questionText: string;
  questionCategory: string;
  answerText: string | null;
  answeredAt: string | null;
  answeredBy: { email: string } | null;
}

interface FollowupQuestionsProps {
  rcfaId: string;
  questions: FollowupQuestion[];
}

function QuestionCard({
  rcfaId,
  question,
  index,
}: {
  rcfaId: string;
  question: FollowupQuestion;
  index: number;
}) {
  const router = useRouter();
  const [answerText, setAnswerText] = useState(question.answerText ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAnswer, setSavedAnswer] = useState(question.answerText);
  const [savedAt, setSavedAt] = useState(question.answeredAt);
  const [savedByEmail, setSavedByEmail] = useState(
    question.answeredBy?.email ?? null
  );
  const [error, setError] = useState<string | null>(null);

  const isDirty = answerText.trim() !== (savedAnswer ?? "");

  async function handleSave() {
    if (!answerText.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/rcfa/${rcfaId}/followup-questions/${question.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerText: answerText.trim() }),
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save answer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-zinc-100 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {index + 1}. {question.questionText}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {question.questionCategory}
        </span>
      </div>

      <div className="mt-3">
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
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
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || !answerText.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FollowupQuestions({
  rcfaId,
  questions,
}: FollowupQuestionsProps) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <QuestionCard key={q.id} rcfaId={rcfaId} question={q} index={i} />
      ))}
    </div>
  );
}
