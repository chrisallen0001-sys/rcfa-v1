"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { ActionItemRow, UserOption } from "./page";
import DateInput from "@/components/DateInput";
import { formatActionItemNumber } from "@/lib/rcfa-utils";

type Props = {
  item: ActionItemRow;
  users: UserOption[];
  priorityLabels: Record<Priority, string>;
  priorityColors: Record<Priority, string>;
  statusLabels: Record<ActionItemStatus, string>;
};

export default function ActionItemCard({
  item,
  users,
  priorityLabels,
  priorityColors,
  statusLabels,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(item.status);
  const [ownerUserId, setOwnerUserId] = useState(item.ownerUserId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<"done" | "canceled" | null>(
    null
  );
  const [completionNotes, setCompletionNotes] = useState(
    item.completionNotes ?? ""
  );
  const [actionTaken, setActionTaken] = useState(item.completionNotes ?? "");
  const [savingActionTaken, setSavingActionTaken] = useState(false);
  const queueRef = useRef<Record<string, unknown>[]>([]);
  const inflightRef = useRef(false);

  const flush = useCallback(async () => {
    if (inflightRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;

    inflightRef.current = true;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      inflightRef.current = false;
      if (queueRef.current.length > 0) {
        flush();
      } else {
        setSaving(false);
        router.refresh();
      }
    }
  }, [item.id, router]);

  useEffect(() => {
    return () => {
      queueRef.current = [];
    };
  }, []);

  function enqueue(patch: Record<string, unknown>) {
    if (queueRef.current.length > 0) {
      const last = queueRef.current[queueRef.current.length - 1];
      queueRef.current[queueRef.current.length - 1] = { ...last, ...patch };
    } else {
      queueRef.current.push(patch);
    }
    flush();
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as ActionItemStatus;
    setStatus(val);
    enqueue({ status: val });
  }

  function handleOwnerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setOwnerUserId(val);
    enqueue({ ownerUserId: val || null });
  }

  function handleDueDateChange(val: string) {
    setDueDate(val);
    enqueue({ dueDate: val || null });
  }

  function handleComplete(target: "done" | "canceled") {
    setCompleting(target);
    setCompletionNotes(actionTaken);
    setError(null);
  }

  function submitCompletion() {
    if (!completing) return;
    const notes = completionNotes.trim() || null;
    enqueue({ status: completing, completionNotes: notes });
    setActionTaken(completionNotes.trim());
    setCompleting(null);
  }

  async function handleSaveActionTaken() {
    setSavingActionTaken(true);
    setError(null);
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNotes: actionTaken.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingActionTaken(false);
    }
  }

  function handleCancelActionTaken() {
    setActionTaken(item.completionNotes ?? "");
  }

  const hasActionTakenChanges =
    (actionTaken.trim() || null) !== (item.completionNotes || null);

  const selectClass =
    "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2 overflow-hidden">
          <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {formatActionItemNumber(item.actionItemNumber)}
          </span>
          <p
            className="line-clamp-3 text-sm font-medium text-zinc-900 sm:block sm:truncate sm:line-clamp-none dark:text-zinc-100"
            title={item.actionText}
          >
            {item.actionText}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[item.priority]}`}
        >
          {priorityLabels[item.priority]}
        </span>
      </div>

      <p className={`mt-2 text-sm ${
        item.actionDescription
          ? "text-zinc-600 dark:text-zinc-400"
          : "italic text-zinc-400 dark:text-zinc-500"
      }`}>
        {item.actionDescription || "No description provided"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Status
          <select
            value={status}
            onChange={handleStatusChange}
            disabled={saving}
            className={selectClass}
          >
            {(Object.keys(statusLabels) as ActionItemStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Owner
          <select
            value={ownerUserId}
            onChange={handleOwnerChange}
            disabled={saving}
            className={selectClass}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>

        <DateInput
          label="Due"
          value={dueDate}
          onChange={handleDueDateChange}
          disabled={saving}
          inline
          minToday
        />
      </div>

      {status !== "done" && status !== "canceled" && !completing && !saving && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleComplete("done")}
            disabled={saving}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
          >
            Complete
          </button>
          <button
            onClick={() => handleComplete("canceled")}
            disabled={saving}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel Item
          </button>
        </div>
      )}

      {completing && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {completing === "done" ? "Completing" : "Canceling"} this action
            item
          </p>
          <textarea
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            placeholder="Action taken (optional)"
            maxLength={2000}
            rows={2}
            className="mb-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mb-2 text-right text-xs text-zinc-400 dark:text-zinc-500">
            {completionNotes.length}/2000
          </p>
          <div className="flex gap-2">
            <button
              onClick={submitCompletion}
              disabled={saving}
              className={`rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                completing === "done"
                  ? "bg-green-600 hover:bg-green-500 dark:bg-green-500 dark:hover:bg-green-400"
                  : "bg-red-600 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400"
              }`}
            >
              {saving
                ? "Saving..."
                : completing === "done"
                  ? "Mark Complete"
                  : "Confirm Cancel"}
            </button>
            <button
              onClick={() => setCompleting(null)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {!completing && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Action Taken
          </label>
          <textarea
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            placeholder="Describe actions taken (optional)"
            maxLength={2000}
            rows={2}
            disabled={savingActionTaken}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {hasActionTakenChanges && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveActionTaken}
                disabled={savingActionTaken}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {savingActionTaken ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelActionTaken}
                disabled={savingActionTaken}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/dashboard/rcfa/${item.rcfaId}`}
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {item.rcfaNumber}
          </span>
          <span className="mx-1.5">·</span>
          <span className="underline">{item.rcfaTitle}</span>
        </Link>
        {saving && <span className="text-zinc-400">Saving...</span>}
        {error && (
          <span className="text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </div>
  );
}
