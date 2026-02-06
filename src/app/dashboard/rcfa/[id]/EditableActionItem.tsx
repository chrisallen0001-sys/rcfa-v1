"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DateInput from "@/components/DateInput";

type User = {
  id: string;
  displayName: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
  canceled: "Canceled",
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  canceled:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

interface EditableActionItemProps {
  rcfaId: string;
  actionItemId: string;
  actionText: string;
  priority: string;
  status: string;
  successCriteria: string | null;
  dueDate: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdByEmail: string;
  createdAt: string;
  isInvestigation: boolean;
}

export default function EditableActionItem({
  rcfaId,
  actionItemId,
  actionText: initialActionText,
  priority: initialPriority,
  status,
  successCriteria: initialSuccessCriteria,
  dueDate: initialDueDate,
  ownerUserId: initialOwnerUserId,
  ownerName,
  createdByEmail,
  createdAt,
  isInvestigation,
}: EditableActionItemProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [actionText, setActionText] = useState(initialActionText);
  const [priority, setPriority] = useState(initialPriority);
  const [successCriteria, setSuccessCriteria] = useState(
    initialSuccessCriteria ?? ""
  );
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId ?? "");
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (editing && users.length === 0) {
      setLoadingUsers(true);
      fetch("/api/users")
        .then((res) => res.ok ? res.json() : [])
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingUsers(false));
    }
  }, [editing, users.length]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/rcfa/${rcfaId}/action-items/finals/${actionItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionText,
            priority,
            successCriteria,
            dueDate: dueDate || null,
            ownerUserId: ownerUserId || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update action item");
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update action item"
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
        `/api/rcfa/${rcfaId}/action-items/finals/${actionItemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete action item");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete action item"
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
        className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Action Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              required
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assigned Owner
              </label>
              <select
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                disabled={loadingUsers}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">{loadingUsers ? "Loading..." : "Unassigned"}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DateInput
              label="Due Date"
              value={dueDate}
              onChange={setDueDate}
              minToday
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Success Criteria
            </label>
            <textarea
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
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
                setActionText(initialActionText);
                setPriority(initialPriority);
                setSuccessCriteria(initialSuccessCriteria ?? "");
                setDueDate(initialDueDate ?? "");
                setOwnerUserId(initialOwnerUserId ?? "");
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
    <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {initialActionText}
        </p>
        <div className="flex gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[initialPriority] ?? ""}`}
          >
            {initialPriority}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STATUS_COLORS[status] ?? ""}`}
          >
            {ACTION_STATUS_LABELS[status] ?? status}
          </span>
        </div>
      </div>
      {initialSuccessCriteria && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Success: {initialSuccessCriteria}
        </p>
      )}
      {initialDueDate && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Due: {initialDueDate}
        </p>
      )}
      {ownerName && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Owner: {ownerName}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Created by {createdByEmail} on {createdAt}
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
                Delete this action item?
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
