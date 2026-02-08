"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OperatingContext } from "@/generated/prisma/client";
import CollapsibleSection from "@/components/CollapsibleSection";
import CurrencyInput from "@/components/CurrencyInput";

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

const OPERATING_CONTEXT_OPTIONS: { value: OperatingContext; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "startup", label: "Startup" },
  { value: "shutdown", label: "Shutdown" },
  { value: "maintenance", label: "Maintenance" },
  { value: "unknown", label: "Unknown" },
];

type FormData = {
  title: string;
  equipmentDescription: string;
  operatingContext: OperatingContext;
  equipmentMake: string;
  equipmentModel: string;
  equipmentSerialNumber: string;
  equipmentAgeYears: string;
  downtimeMinutes: string;
  productionCostUsd: string;
  maintenanceCostUsd: string;
  failureDescription: string;
  preFailureConditions: string;
  workHistorySummary: string;
  activePmsSummary: string;
  additionalNotes: string;
};

/** Fields required before starting investigation */
export type RequiredField = "title" | "equipmentDescription" | "failureDescription";

type Props = {
  rcfaId: string;
  initialData: {
    title: string;
    equipmentDescription: string;
    operatingContext: OperatingContext;
    equipmentMake: string | null;
    equipmentModel: string | null;
    equipmentSerialNumber: string | null;
    equipmentAgeYears: number | null;
    downtimeMinutes: number | null;
    productionCostUsd: number | null;
    maintenanceCostUsd: number | null;
    failureDescription: string;
    preFailureConditions: string | null;
    workHistorySummary: string | null;
    activePmsSummary: string | null;
    additionalNotes: string | null;
  };
  /** Expand intake form by default (e.g., for newly created RCFAs) */
  defaultExpanded?: boolean;
  /** Ref to expose save function for external callers (e.g., action bar) */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  /** Callback when dirty state changes (has unsaved edits or pending save) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Callback when required field validity changes */
  onMissingFieldsChange?: (missingFields: RequiredField[]) => void;
};

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

const textareaClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

const selectClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500";

const AUTO_SAVE_DELAY_MS = 2000;
const SAVED_INDICATOR_DURATION_MS = 2000;

export default function EditableIntakeForm({ rcfaId, initialData, defaultExpanded = false, onSaveRef, onDirtyChange, onMissingFieldsChange }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    title: initialData.title,
    equipmentDescription: initialData.equipmentDescription,
    operatingContext: initialData.operatingContext,
    equipmentMake: initialData.equipmentMake ?? "",
    equipmentModel: initialData.equipmentModel ?? "",
    equipmentSerialNumber: initialData.equipmentSerialNumber ?? "",
    equipmentAgeYears: initialData.equipmentAgeYears?.toString() ?? "",
    downtimeMinutes: initialData.downtimeMinutes?.toString() ?? "",
    productionCostUsd: initialData.productionCostUsd?.toString() ?? "",
    maintenanceCostUsd: initialData.maintenanceCostUsd?.toString() ?? "",
    failureDescription: initialData.failureDescription,
    preFailureConditions: initialData.preFailureConditions ?? "",
    workHistorySummary: initialData.workHistorySummary ?? "",
    activePmsSummary: initialData.activePmsSummary ?? "",
    additionalNotes: initialData.additionalNotes ?? "",
  });


  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [hasPendingDebounce, setHasPendingDebounce] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef(formData);
  const autoSaveStatusRef = useRef<AutoSaveStatus>("idle");
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep refs in sync with state for use in async callbacks
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    autoSaveStatusRef.current = autoSaveStatus;
  }, [autoSaveStatus]);

  // Track dirty state: has pending debounce timer or is currently saving
  const hasPendingChanges = hasPendingDebounce || autoSaveStatus === "saving";

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(hasPendingChanges);
  }, [hasPendingChanges, onDirtyChange]);

  // Compute and notify parent of missing required fields
  useEffect(() => {
    const missing: RequiredField[] = [];
    if (!formData.title.trim()) missing.push("title");
    if (!formData.equipmentDescription.trim()) missing.push("equipmentDescription");
    if (!formData.failureDescription.trim()) missing.push("failureDescription");
    onMissingFieldsChange?.(missing);
  }, [formData.title, formData.equipmentDescription, formData.failureDescription, onMissingFieldsChange]);

  // Browser navigation guard: warn about unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // Check if there are pending changes (debounce timer active or currently saving)
      if (debounceTimerRef.current !== null || autoSaveStatusRef.current === "saving") {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
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

  // Perform the actual save
  const performSave = useCallback(async (data: FormData, signal?: AbortSignal): Promise<void> => {
    const payload: Record<string, unknown> = {
      title: data.title,
      equipmentDescription: data.equipmentDescription,
      operatingContext: data.operatingContext,
      equipmentMake: data.equipmentMake || null,
      equipmentModel: data.equipmentModel || null,
      equipmentSerialNumber: data.equipmentSerialNumber || null,
      equipmentAgeYears: data.equipmentAgeYears || null,
      downtimeMinutes: data.downtimeMinutes || null,
      productionCostUsd: data.productionCostUsd || null,
      maintenanceCostUsd: data.maintenanceCostUsd || null,
      failureDescription: data.failureDescription,
      preFailureConditions: data.preFailureConditions || null,
      workHistorySummary: data.workHistorySummary || null,
      activePmsSummary: data.activePmsSummary || null,
      additionalNotes: data.additionalNotes || null,
    };

    const res = await fetch(`/api/rcfa/${rcfaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to save changes");
    }
  }, [rcfaId]);

  // Debounced auto-save function
  const triggerAutoSave = useCallback(() => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Clear saved indicator timer
    if (savedIndicatorTimerRef.current) {
      clearTimeout(savedIndicatorTimerRef.current);
    }

    // Reset to idle if we were showing "saved" (use ref to avoid stale closure)
    if (autoSaveStatusRef.current === "saved") {
      setAutoSaveStatus("idle");
    }

    // Mark that we have a pending debounce
    setHasPendingDebounce(true);

    // Set up new debounce timer
    debounceTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;

      // Timer fired, no longer pending
      setHasPendingDebounce(false);

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setAutoSaveStatus("saving");
      setAutoSaveError(null);

      try {
        await performSave(formDataRef.current, abortControllerRef.current.signal);
        if (!isMountedRef.current) return;

        setAutoSaveStatus("saved");

        // Hide "saved" indicator after 2 seconds
        savedIndicatorTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setAutoSaveStatus("idle");
          }
        }, SAVED_INDICATOR_DURATION_MS);

        router.refresh();
      } catch (err) {
        if (!isMountedRef.current) return;
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") return;

        setAutoSaveStatus("error");
        setAutoSaveError(
          err instanceof Error ? err.message : "Failed to save"
        );
      }
    }, AUTO_SAVE_DELAY_MS);
  }, [performSave, router]);

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Trigger debounced auto-save
      triggerAutoSave();
    },
    [triggerAutoSave]
  );

  // Retry failed auto-save - performs immediate save (no debounce delay)
  const handleRetry = async () => {
    // Cancel any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      setHasPendingDebounce(false);
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setAutoSaveStatus("saving");
    setAutoSaveError(null);

    try {
      await performSave(formDataRef.current, abortControllerRef.current.signal);
      if (!isMountedRef.current) return;

      setAutoSaveStatus("saved");

      savedIndicatorTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setAutoSaveStatus("idle");
        }
      }, SAVED_INDICATOR_DURATION_MS);

      router.refresh();
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof Error && err.name === "AbortError") return;

      setAutoSaveStatus("error");
      setAutoSaveError(
        err instanceof Error ? err.message : "Failed to save"
      );
    }
  };

  // Helper to save form before an action (exposed via onSaveRef for external callers)
  const saveBeforeAction = useCallback(async (): Promise<boolean> => {
    // Cancel any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      setHasPendingDebounce(false);
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear saved indicator timer
    if (savedIndicatorTimerRef.current) {
      clearTimeout(savedIndicatorTimerRef.current);
    }

    setAutoSaveStatus("saving");
    setAutoSaveError(null);

    try {
      await performSave(formDataRef.current);
      if (!isMountedRef.current) return false;
      setAutoSaveStatus("saved");

      // Hide "saved" indicator after 2 seconds
      savedIndicatorTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setAutoSaveStatus("idle");
        }
      }, SAVED_INDICATOR_DURATION_MS);

      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;
      setAutoSaveStatus("error");
      setAutoSaveError(
        err instanceof Error ? err.message : "Failed to save"
      );
      return false;
    }
  }, [performSave]);

  // Expose save function via ref for external callers (e.g., action bar)
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = saveBeforeAction;
    }
    return () => {
      if (onSaveRef) {
        onSaveRef.current = null;
      }
    };
  }, [onSaveRef, saveBeforeAction]);

  return (
    <CollapsibleSection
      title="Intake Summary"
      defaultExpanded={defaultExpanded}
      headerContent={
          <div className="flex items-center gap-3">
            {/* Auto-save status indicator */}
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
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
                Saving...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Saved
              </span>
            )}
            {autoSaveStatus === "error" && (
              <span className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <span>{autoSaveError || "Failed to save"}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              </span>
            )}
          </div>
        }
      >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Title" required>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Brief title for this RCFA"
            className={inputClass}
            maxLength={200}
          />
        </FormField>

        <FormField label="Operating Context" required>
          <select
            name="operatingContext"
            value={formData.operatingContext}
            onChange={handleChange}
            className={selectClass}
          >
            {OPERATING_CONTEXT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Equipment Description" required>
          <input
            type="text"
            name="equipmentDescription"
            value={formData.equipmentDescription}
            onChange={handleChange}
            placeholder="Equipment or asset description"
            className={inputClass}
          />
        </FormField>

        <FormField label="Make">
          <input
            type="text"
            name="equipmentMake"
            value={formData.equipmentMake}
            onChange={handleChange}
            placeholder="Manufacturer"
            className={inputClass}
          />
        </FormField>

        <FormField label="Model">
          <input
            type="text"
            name="equipmentModel"
            value={formData.equipmentModel}
            onChange={handleChange}
            placeholder="Model number"
            className={inputClass}
          />
        </FormField>

        <FormField label="Serial Number">
          <input
            type="text"
            name="equipmentSerialNumber"
            value={formData.equipmentSerialNumber}
            onChange={handleChange}
            placeholder="Serial number"
            className={inputClass}
          />
        </FormField>

        <FormField label="Equipment Age (years)">
          <input
            type="number"
            name="equipmentAgeYears"
            value={formData.equipmentAgeYears}
            onChange={handleChange}
            placeholder="0"
            min="0"
            max="9999"
            step="0.01"
            className={inputClass}
          />
        </FormField>

        <FormField label="Downtime (minutes)">
          <input
            type="number"
            name="downtimeMinutes"
            value={formData.downtimeMinutes}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="1"
            className={inputClass}
          />
        </FormField>

        <FormField label="Production Cost (USD)">
          <CurrencyInput
            name="productionCostUsd"
            value={formData.productionCostUsd}
            onChange={handleChange}
            className={inputClass}
          />
        </FormField>

        <FormField label="Maintenance Cost (USD)">
          <CurrencyInput
            name="maintenanceCostUsd"
            value={formData.maintenanceCostUsd}
            onChange={handleChange}
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 grid gap-4">
        <FormField label="Failure Description" required>
          <textarea
            name="failureDescription"
            value={formData.failureDescription}
            onChange={handleChange}
            placeholder="Describe the failure event"
            rows={3}
            className={textareaClass}
          />
        </FormField>

        <FormField label="Pre-Failure Conditions">
          <textarea
            name="preFailureConditions"
            value={formData.preFailureConditions}
            onChange={handleChange}
            placeholder="Conditions observed before the failure"
            rows={3}
            className={textareaClass}
          />
        </FormField>

        <FormField label="Work History Summary">
          <textarea
            name="workHistorySummary"
            value={formData.workHistorySummary}
            onChange={handleChange}
            placeholder="Recent maintenance or repair history"
            rows={3}
            className={textareaClass}
          />
        </FormField>

        <FormField label="Active PMs Summary">
          <textarea
            name="activePmsSummary"
            value={formData.activePmsSummary}
            onChange={handleChange}
            placeholder="Active preventive maintenance tasks"
            rows={3}
            className={textareaClass}
          />
        </FormField>

        <FormField label="Additional Notes">
          <textarea
            name="additionalNotes"
            value={formData.additionalNotes}
            onChange={handleChange}
            placeholder="Any other relevant information"
            rows={3}
            className={textareaClass}
          />
        </FormField>
      </div>
    </CollapsibleSection>
  );
}
