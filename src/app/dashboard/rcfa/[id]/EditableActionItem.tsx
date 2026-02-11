"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DateInput from "@/components/DateInput";
import { useUsers } from "./useUsers";
import { formatActionItemNumber } from "@/lib/rcfa-utils";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
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
  done: "Complete",
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
  actionItemNumber: number;
  actionText: string;
  actionDescription: string | null;
  completionNotes: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdByEmail: string;
  createdAt: string;
  canEdit: boolean;
}

export default function EditableActionItem({
  rcfaId,
  actionItemId,
  actionItemNumber,
  actionText: initialActionText,
  actionDescription: initialActionDescription,
  completionNotes: initialCompletionNotes,
  priority: initialPriority,
  status,
  dueDate: initialDueDate,
  ownerUserId: initialOwnerUserId,
  ownerName,
  createdByEmail,
  createdAt,
  canEdit,
}: EditableActionItemProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionText, setActionText] = useState(initialActionText);
  const [actionDescription, setActionDescription] = useState(
    initialActionDescription ?? ""
  );
  const [completionNotes, setCompletionNotes] = useState(
    initialCompletionNotes ?? ""
  );
  const [priority, setPriority] = useState(initialPriority);
  const [editStatus, setEditStatus] = useState(status);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId ?? "");
  const { users, loading: loadingUsers } = useUsers(canEdit && (editing || isExpanded));
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
        `/api/rcfa/${rcfaId}/action-items/finals/${actionItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionText,
            actionDescription: actionDescription || null,
            priority,
            status: editStatus,
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

  async function handleSaveCompletionNotes() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/action-items/${actionItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionNotes: completionNotes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update action taken");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update action taken"
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

  function handleCancel() {
    setEditing(false);
    setActionText(initialActionText);
    setActionDescription(initialActionDescription ?? "");
    setPriority(initialPriority);
    setEditStatus(status);
    setDueDate(initialDueDate ?? "");
    setOwnerUserId(initialOwnerUserId ?? "");
    setError(null);
  }

  function handleCancelCompletionNotes() {
    setCompletionNotes(initialCompletionNotes ?? "");
  }

  const hasCompletionNotesChanges =
    (completionNotes || null) !== (initialCompletionNotes || null);

  // Collapsed header row (non-interactive when editing)
  const headerRow = (
    <button
      type="button"
      onClick={() => !editing && setIsExpanded(!isExpanded)}
      disabled={editing}
      className={`flex w-full px-4 py-3 text-left ${
        editing ? "cursor-default" : "cursor-pointer"
      }`}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Collapse action item" : "Expand action item"}
    >
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* Row 1 on mobile / Left section on desktop: AI number + title */}
        <div className="flex items-baseline gap-2 sm:min-w-0 sm:flex-1">
          <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {formatActionItemNumber(actionItemNumber)}
          </span>
          <p
            className="line-clamp-2 text-sm font-medium text-zinc-900 sm:truncate dark:text-zinc-100"
            title={initialActionText}
          >
            {initialActionText}
          </p>
        </div>
        {/* Row 2 on mobile / Right section on desktop: badges + chevron */}
        <div className="flex items-center justify-between sm:justify-end sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[initialPriority] ?? ""}`}
            >
              {PRIORITY_LABELS[initialPriority] ?? initialPriority}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STATUS_COLORS[status] ?? ""}`}
            >
              {ACTION_STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <svg
            className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </button>
  );

  // Editing form content
  if (editing) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {headerRow}
        <form onSubmit={handleSave} className="px-4 pb-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Action Title <span className="text-red-500">*</span>
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
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Action Description
              </label>
              <textarea
                value={actionDescription}
                onChange={(e) => setActionDescription(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="Detailed explanation of the action..."
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
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
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Complete</option>
                  <option value="canceled">Canceled</option>
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
                  <option value="">
                    {loadingUsers ? "Loading..." : "Unassigned"}
                  </option>
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
                onClick={handleCancel}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Read-only expanded view
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {headerRow}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-4 px-4 pb-4">
          {/* Action Description */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Action Description
            </p>
            <p className={`mt-1 whitespace-pre-wrap text-sm ${
              initialActionDescription
                ? "text-zinc-700 dark:text-zinc-300"
                : "italic text-zinc-400 dark:text-zinc-500"
            }`}>
              {initialActionDescription || "No description provided"}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Priority
              </p>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                {PRIORITY_LABELS[initialPriority] ?? initialPriority}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Status
              </p>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                {ACTION_STATUS_LABELS[status] ?? status}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Assigned Owner
              </p>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                {ownerName ?? "Unassigned"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Due Date
              </p>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                {initialDueDate ?? "—"}
              </p>
            </div>
          </div>

          {/* Action Taken - always visible, editable when canEdit */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Action Taken
            </p>
            {canEdit ? (
              <div className="mt-1">
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Action taken (optional)"
                  maxLength={2000}
                  rows={2}
                  className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {completionNotes.length}/2000
                  </span>
                  {hasCompletionNotesChanges && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCompletionNotes}
                        disabled={loading}
                        className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400"
                      >
                        {loading ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelCompletionNotes}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {initialCompletionNotes ?? "—"}
              </p>
            )}
          </div>

          {/* Footer - created info */}
          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Created by {createdByEmail} on {createdAt}
            </p>
          </div>

          {/* Edit/Delete buttons */}
          {canEdit && (
            <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}
