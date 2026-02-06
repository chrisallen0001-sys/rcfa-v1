"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { OperatingContext } from "@/generated/prisma/client";

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

export default function EditableIntakeForm({ rcfaId, initialData }: Props) {
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

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      setFeedback(null);
    },
    []
  );

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        equipmentDescription: formData.equipmentDescription,
        operatingContext: formData.operatingContext,
        equipmentMake: formData.equipmentMake || null,
        equipmentModel: formData.equipmentModel || null,
        equipmentSerialNumber: formData.equipmentSerialNumber || null,
        equipmentAgeYears: formData.equipmentAgeYears || null,
        downtimeMinutes: formData.downtimeMinutes || null,
        productionCostUsd: formData.productionCostUsd || null,
        maintenanceCostUsd: formData.maintenanceCostUsd || null,
        failureDescription: formData.failureDescription,
        preFailureConditions: formData.preFailureConditions || null,
        workHistorySummary: formData.workHistorySummary || null,
        activePmsSummary: formData.activePmsSummary || null,
        additionalNotes: formData.additionalNotes || null,
      };

      const res = await fetch(`/api/rcfa/${rcfaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save changes");
      }

      setFeedback({ type: "success", message: "Changes saved" });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save changes",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Intake Summary
        </h2>
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
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Title">
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
          <input
            type="number"
            name="productionCostUsd"
            value={formData.productionCostUsd}
            onChange={handleChange}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </FormField>

        <FormField label="Maintenance Cost (USD)">
          <input
            type="number"
            name="maintenanceCostUsd"
            value={formData.maintenanceCostUsd}
            onChange={handleChange}
            placeholder="0.00"
            min="0"
            step="0.01"
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
    </section>
  );
}
