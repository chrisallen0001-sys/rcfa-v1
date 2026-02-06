"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AddInformationSectionProps {
  rcfaId: string;
  initialNotes: string | null;
}

const textareaClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

export default function AddInformationSection({
  rcfaId,
  initialNotes,
}: AddInformationSectionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const hasChanges = notes !== (initialNotes ?? "");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNotes(e.target.value);
      setFeedback(null);
    },
    []
  );

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/rcfa/${rcfaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investigationNotes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save changes");
      }

      setFeedback({ type: "success", message: "Saved" });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-purple-200 bg-purple-50/50 p-6 dark:border-purple-900 dark:bg-purple-950/20">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Add Information
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Add new findings, lab results, or other information discovered during investigation.
            After saving, you can re-analyze to incorporate the new data.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <textarea
          value={notes}
          onChange={handleChange}
          placeholder="Enter new findings, observations, test results, or other information relevant to the investigation..."
          rows={5}
          className={textareaClass}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {feedback && (
              <span
                className={`text-sm ${
                  feedback.type === "success"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {feedback.message}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-400"
          >
            {isSaving ? "Saving..." : "Save Information"}
          </button>
        </div>
      </div>
    </section>
  );
}
