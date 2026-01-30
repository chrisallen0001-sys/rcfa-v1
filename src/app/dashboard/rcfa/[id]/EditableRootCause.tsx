"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface EditableRootCauseProps {
  rcfaId: string;
  finalId: string;
  causeText: string;
  evidenceSummary: string | null;
  selectedByEmail: string;
  selectedAt: string;
  isInvestigation: boolean;
}

export default function EditableRootCause({
  rcfaId,
  finalId,
  causeText: initialCauseText,
  evidenceSummary: initialEvidenceSummary,
  selectedByEmail,
  selectedAt,
  isInvestigation,
}: EditableRootCauseProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [causeText, setCauseText] = useState(initialCauseText);
  const [evidenceSummary, setEvidenceSummary] = useState(
    initialEvidenceSummary ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRef = useRef(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/rcfa/${rcfaId}/root-causes/finals/${finalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ causeText, evidenceSummary }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update root cause");
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update root cause"
      );
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/rcfa/${rcfaId}/root-causes/finals/${finalId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete root cause");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete root cause"
      );
    } finally {
      pendingRef.current = false;
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cause Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={causeText}
              onChange={(e) => setCauseText(e.target.value)}
              required
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Evidence Summary
            </label>
            <textarea
              value={evidenceSummary}
              onChange={(e) => setEvidenceSummary(e.target.value)}
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setCauseText(initialCauseText);
                setEvidenceSummary(initialEvidenceSummary ?? "");
                setError(null);
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {initialCauseText}
      </p>
      {initialEvidenceSummary && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {initialEvidenceSummary}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Selected by {selectedByEmail} on {selectedAt}
      </p>
      {isInvestigation && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-600 dark:text-red-400">
                Delete this root cause?
              </span>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
              >
                {loading ? "Deleting..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
          )}
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
