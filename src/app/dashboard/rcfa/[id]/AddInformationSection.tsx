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
import CollapsibleSection from "@/components/CollapsibleSection";
import type { SectionStatus } from "@/components/SectionStatusIndicator";

const DEBOUNCE_MS = 2000;
const SAVED_INDICATOR_MS = 3000;

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface AddInformationSectionHandle {
  /** Flushes pending saves. Throws if save fails. */
  flush: () => Promise<void>;
}

interface AddInformationSectionProps {
  rcfaId: string;
  initialNotes: string | null;
  /** Status indicator for workflow guidance */
  status?: SectionStatus;
}

const textareaClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

const AddInformationSection = forwardRef<
  AddInformationSectionHandle,
  AddInformationSectionProps
>(function AddInformationSection({ rcfaId, initialNotes, status }, ref) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const lastSaveErrorRef = useRef<string | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const savedNotesRef = useRef(savedNotes);
  savedNotesRef.current = savedNotes;

  const save = useCallback(
    async (textToSave: string): Promise<void> => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setSaveStatus("saving");
      setError(null);
      lastSaveErrorRef.current = null;

      try {
        const res = await fetch(`/api/rcfa/${rcfaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investigationNotes: textToSave || null,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save changes");
        }

        setSavedNotes(textToSave);
        setSaveStatus("saved");
        router.refresh();

        // Auto-clear "Saved" indicator after delay
        if (savedIndicatorTimerRef.current) {
          clearTimeout(savedIndicatorTimerRef.current);
        }
        savedIndicatorTimerRef.current = setTimeout(() => {
          setSaveStatus((current) => (current === "saved" ? "idle" : current));
        }, SAVED_INDICATOR_MS);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was aborted - clear promise ref since it's no longer valid
          savePromiseRef.current = null;
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save";
        setError(errorMessage);
        setSaveStatus("error");
        lastSaveErrorRef.current = errorMessage;
      }
    },
    [rcfaId, router]
  );

  // Expose flush method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      flush: async () => {
        // Clear debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        // If we have pending changes, start save immediately
        const currentNotes = notesRef.current;
        const currentSaved = savedNotesRef.current;
        if (currentNotes !== currentSaved) {
          savePromiseRef.current = save(currentNotes);
        }

        // Wait for any in-flight or just-started save to complete
        if (savePromiseRef.current) {
          await savePromiseRef.current;
        }

        // Propagate save errors to caller
        if (lastSaveErrorRef.current) {
          const errorMsg = lastSaveErrorRef.current;
          lastSaveErrorRef.current = null;
          throw new Error(errorMsg);
        }
      },
    }),
    [save]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setNotes(newValue);

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Check if there's an actual change from what's saved
      if (newValue !== savedNotes) {
        setSaveStatus("pending");
        debounceTimerRef.current = setTimeout(() => {
          savePromiseRef.current = save(newValue);
        }, DEBOUNCE_MS);
      } else {
        setSaveStatus("idle");
      }
    },
    [savedNotes, save]
  );

  const retryHandler = useCallback(() => {
    savePromiseRef.current = save(notesRef.current);
  }, [save]);

  // Navigation guard: warn user about unsaved changes
  useEffect(() => {
    const hasPending = saveStatus === "pending" || saveStatus === "saving";

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasPending) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (savedIndicatorTimerRef.current) {
        clearTimeout(savedIndicatorTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  function renderStatusIndicator() {
    switch (saveStatus) {
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
    <CollapsibleSection title="Supporting Info" status={status}>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Add new findings, lab results, or other information discovered during
        investigation. After saving, you can re-analyze to incorporate the new
        data.
      </p>

      <div className="space-y-4">
        <textarea
          value={notes}
          onChange={handleChange}
          placeholder="Enter new findings, observations, test results, or other information relevant to the investigation..."
          rows={5}
          className={textareaClass}
        />

        <div className="flex items-center justify-end">
          {renderStatusIndicator()}
        </div>
      </div>
    </CollapsibleSection>
  );
});

export default AddInformationSection;
