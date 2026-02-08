"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import CollapsibleSection from "@/components/CollapsibleSection";
import type { SectionStatus } from "@/components/SectionStatusIndicator";

interface AddInformationSectionProps {
  rcfaId: string;
  initialNotes: string | null;
  /** Status indicator for workflow guidance */
  status?: SectionStatus;
}

const textareaClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

export default function AddInformationSection({
  rcfaId,
  initialNotes,
  status,
}: AddInformationSectionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const pendingRef = useRef(false);

  const hasChanges = notes !== (initialNotes ?? "");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNotes(e.target.value);
      setFeedback(null);
    },
    []
  );

  const handleSave = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
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
      pendingRef.current = false;
    }
  };

  return (
    <CollapsibleSection title="Supporting Info" status={status}>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Add new findings, lab results, or other information discovered during investigation.
        After saving, you can re-analyze to incorporate the new data.
      </p>

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
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSaving ? "Saving..." : "Save Information"}
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
