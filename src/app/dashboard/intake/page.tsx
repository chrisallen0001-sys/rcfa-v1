"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { useElapsedTime } from "../rcfa/[id]/useElapsedTime";

const OPERATING_CONTEXTS = [
  { value: "unknown", label: "Unknown" },
  { value: "running", label: "Running" },
  { value: "startup", label: "Startup" },
  { value: "shutdown", label: "Shutdown" },
  { value: "maintenance", label: "Maintenance" },
] as const;

interface IntakeFormData {
  title: string;
  equipmentDescription: string;
  equipmentMake: string;
  equipmentModel: string;
  equipmentSerialNumber: string;
  equipmentAgeYears: string;
  workHistorySummary: string;
  activePmsSummary: string;
  operatingContext: string;
  preFailureConditions: string;
  failureDescription: string;
  additionalNotes: string;
}

const INITIAL_FORM: IntakeFormData = {
  title: "",
  equipmentDescription: "",
  equipmentMake: "",
  equipmentModel: "",
  equipmentSerialNumber: "",
  equipmentAgeYears: "",
  workHistorySummary: "",
  activePmsSummary: "",
  operatingContext: "unknown",
  preFailureConditions: "",
  failureDescription: "",
  additionalNotes: "",
};

export default function IntakePage() {
  const router = useRouter();
  const [form, setForm] = useState<IntakeFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeFormData, string>>>({});
  const [submitPhase, setSubmitPhase] = useState<"idle" | "creating" | "analyzing">("idle");
  const submitting = submitPhase !== "idle";
  const [submitError, setSubmitError] = useState("");
  const elapsed = useElapsedTime(submitPhase === "analyzing");

  function updateField(field: keyof IntakeFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof IntakeFormData, string>> = {};

    if (!form.title.trim()) {
      next.title = "Title is required.";
    } else if (form.title.trim().length > 200) {
      next.title = "Title must be 200 characters or fewer.";
    }
    if (!form.equipmentDescription.trim()) {
      next.equipmentDescription = "Equipment description is required.";
    }
    if (!form.failureDescription.trim()) {
      next.failureDescription = "Failure description is required.";
    }
    if (!form.operatingContext) {
      next.operatingContext = "Operating context is required.";
    }
    if (form.equipmentAgeYears && (isNaN(Number(form.equipmentAgeYears)) || Number(form.equipmentAgeYears) < 0)) {
      next.equipmentAgeYears = "Age must be a non-negative number.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!validate()) return;

    setSubmitPhase("creating");
    try {
      const createRes = await fetch("/api/rcfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          equipmentDescription: form.equipmentDescription.trim(),
          equipmentMake: form.equipmentMake.trim() || undefined,
          equipmentModel: form.equipmentModel.trim() || undefined,
          equipmentSerialNumber: form.equipmentSerialNumber.trim() || undefined,
          equipmentAgeYears: form.equipmentAgeYears ? Number(form.equipmentAgeYears) : undefined,
          workHistorySummary: form.workHistorySummary.trim() || undefined,
          activePmsSummary: form.activePmsSummary.trim() || undefined,
          operatingContext: form.operatingContext,
          preFailureConditions: form.preFailureConditions.trim() || undefined,
          failureDescription: form.failureDescription.trim(),
          additionalNotes: form.additionalNotes.trim() || undefined,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        setSubmitError(data.error || "Failed to create RCFA.");
        return;
      }

      const { id } = await createRes.json();

      setSubmitPhase("analyzing");
      const analyzeRes = await fetch(`/api/rcfa/${id}/analyze`, {
        method: "POST",
      });

      if (!analyzeRes.ok) {
        router.push(`/dashboard/rcfa/${id}?analyzeError=1`);
        return;
      }

      router.push(`/dashboard/rcfa/${id}`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitPhase("idle");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        New RCFA
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Describe the equipment and failure to begin root cause analysis.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {submitError && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {submitError}
          </div>
        )}

        {/* RCFA Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            RCFA Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            placeholder="e.g. Pump P-101 Bearing Failure"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            A short, descriptive title to identify this RCFA
          </p>
        </div>

        {/* Equipment Description */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Equipment Information
          </legend>

          <div>
            <label htmlFor="equipmentDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Equipment Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="equipmentDescription"
              required
              rows={3}
              value={form.equipmentDescription}
              onChange={(e) => updateField("equipmentDescription", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="e.g. Centrifugal pump, 250HP, cooling water system"
            />
            {errors.equipmentDescription && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.equipmentDescription}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="equipmentMake" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Make
              </label>
              <input
                id="equipmentMake"
                type="text"
                value={form.equipmentMake}
                onChange={(e) => updateField("equipmentMake", e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="e.g. Flowserve"
              />
            </div>
            <div>
              <label htmlFor="equipmentModel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Model
              </label>
              <input
                id="equipmentModel"
                type="text"
                value={form.equipmentModel}
                onChange={(e) => updateField("equipmentModel", e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="e.g. HPX-200"
              />
            </div>
            <div>
              <label htmlFor="equipmentSerialNumber" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Serial Number
              </label>
              <input
                id="equipmentSerialNumber"
                type="text"
                value={form.equipmentSerialNumber}
                onChange={(e) => updateField("equipmentSerialNumber", e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                placeholder="e.g. SN-12345"
              />
            </div>
          </div>

          <div className="max-w-[200px]">
            <label htmlFor="equipmentAgeYears" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Approximate Age (years)
            </label>
            <input
              id="equipmentAgeYears"
              type="number"
              min="0"
              step="0.01"
              value={form.equipmentAgeYears}
              onChange={(e) => updateField("equipmentAgeYears", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="e.g. 5.5"
            />
            {errors.equipmentAgeYears && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.equipmentAgeYears}</p>
            )}
          </div>
        </fieldset>

        {/* Maintenance History */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Maintenance History
          </legend>

          <div>
            <label htmlFor="workHistorySummary" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Recent Work History
            </label>
            <textarea
              id="workHistorySummary"
              rows={3}
              value={form.workHistorySummary}
              onChange={(e) => updateField("workHistorySummary", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Summarize recent maintenance, repairs, or modifications"
            />
          </div>

          <div>
            <label htmlFor="activePmsSummary" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Active PMs / PdMs
            </label>
            <textarea
              id="activePmsSummary"
              rows={3}
              value={form.activePmsSummary}
              onChange={(e) => updateField("activePmsSummary", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="List active preventive or predictive maintenance tasks"
            />
          </div>
        </fieldset>

        {/* Failure Details */}
        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Failure Details
          </legend>

          <div>
            <label htmlFor="operatingContext" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Operating Context <span className="text-red-500">*</span>
            </label>
            <select
              id="operatingContext"
              required
              value={form.operatingContext}
              onChange={(e) => updateField("operatingContext", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {OPERATING_CONTEXTS.map((ctx) => (
                <option key={ctx.value} value={ctx.value}>
                  {ctx.label}
                </option>
              ))}
            </select>
            {errors.operatingContext && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.operatingContext}</p>
            )}
          </div>

          <div>
            <label htmlFor="preFailureConditions" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Pre-Failure Conditions
            </label>
            <textarea
              id="preFailureConditions"
              rows={3}
              value={form.preFailureConditions}
              onChange={(e) => updateField("preFailureConditions", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="What was happening before the failure? Any unusual conditions?"
            />
          </div>

          <div>
            <label htmlFor="failureDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Failure Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="failureDescription"
              required
              rows={4}
              value={form.failureDescription}
              onChange={(e) => updateField("failureDescription", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Describe the failure in detail: what happened, symptoms, timeline"
            />
            {errors.failureDescription && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.failureDescription}</p>
            )}
          </div>

          <div>
            <label htmlFor="additionalNotes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Additional Notes
            </label>
            <textarea
              id="additionalNotes"
              rows={3}
              value={form.additionalNotes}
              onChange={(e) => updateField("additionalNotes", e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Any other relevant information"
            />
          </div>
        </fieldset>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {submitPhase === "creating" ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Creating...
              </span>
            ) : submitPhase === "analyzing" ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Analyzing... {elapsed}s
              </span>
            ) : (
              "Create RCFA"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
