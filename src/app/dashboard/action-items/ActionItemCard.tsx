"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { ActionItemRow, UserOption } from "./page";

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

  function enqueue(patch: Record<string, unknown>) {
    queueRef.current.push(patch);
    flush();
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as ActionItemStatus;
    setStatus(val);
    enqueue({ status: val });
  }

  function handleOwnerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    setOwnerUserId(val ?? "");
    enqueue({ ownerUserId: val });
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setDueDate(val);
    enqueue({ dueDate: val || null });
  }

  const selectClass =
    "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {item.actionText}
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[item.priority]}`}
        >
          {priorityLabels[item.priority]}
        </span>
      </div>

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

        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={handleDueDateChange}
            disabled={saving}
            className={selectClass}
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/dashboard/rcfa/${item.rcfaId}`}
          className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {item.rcfaTitle}
        </Link>
        {saving && <span className="text-zinc-400">Saving...</span>}
        {error && (
          <span className="text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </div>
  );
}
