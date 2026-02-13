"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import DateInput from "@/components/DateInput";
import { useUsers } from "./useUsers";
import {
  formatDateShort,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
} from "@/lib/rcfa-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DrawerMode = "view" | "edit" | "add";

export interface ActionItemData {
  actionItemId: string;
  actionItemNumber: number;
  actionText: string;
  actionDescription: string | null;
  completionNotes: string | null;
  priority: Priority;
  status: ActionItemStatus;
  dueDate: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  createdByEmail: string;
  createdAt: string;
}

export interface ActionItemDrawerContentProps {
  mode: DrawerMode;
  rcfaId: string;
  canEdit: boolean;
  /** Action item data -- required for "view" and "edit" modes, omitted for "add" */
  actionItem?: ActionItemData;
  onClose: () => void;
  onModeChange: (mode: DrawerMode) => void;
}

// ---------------------------------------------------------------------------
// Shared form field styles
// ---------------------------------------------------------------------------

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const btnPrimary =
  "rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-400";

const btnSecondary =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const btnDanger =
  "rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20";

const btnDangerFilled =
  "rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionItemDrawerContent({
  mode,
  rcfaId,
  canEdit,
  actionItem,
  onClose,
  onModeChange,
}: ActionItemDrawerContentProps) {
  if (mode === "view") {
    if (!actionItem) return null;
    return (
      <ViewMode
        actionItem={actionItem}
        canEdit={canEdit}
        rcfaId={rcfaId}
        onClose={onClose}
        onModeChange={onModeChange}
      />
    );
  }

  if (mode === "edit") {
    if (!actionItem) return null;
    return (
      <EditMode
        actionItem={actionItem}
        rcfaId={rcfaId}
        onModeChange={onModeChange}
      />
    );
  }

  return <AddMode rcfaId={rcfaId} onClose={onClose} />;
}

// ---------------------------------------------------------------------------
// View Mode
// ---------------------------------------------------------------------------

function ViewMode({
  actionItem,
  canEdit,
  rcfaId,
  onClose,
  onModeChange,
}: {
  actionItem: ActionItemData;
  canEdit: boolean;
  rcfaId: string;
  onClose: () => void;
  onModeChange: (mode: DrawerMode) => void;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Completion notes inline editing
  const [completionNotes, setCompletionNotes] = useState(
    actionItem.completionNotes ?? ""
  );

  useEffect(() => {
    setCompletionNotes(actionItem.completionNotes ?? "");
  }, [actionItem.actionItemId, actionItem.completionNotes]);

  const hasCompletionNotesChanges =
    (completionNotes || null) !== (actionItem.completionNotes || null);

  async function handleSaveCompletionNotes() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/action-items/${actionItem.actionItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNotes: completionNotes || null }),
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
        `/api/rcfa/${rcfaId}/action-items/finals/${actionItem.actionItemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete action item");
      }

      router.refresh();
      onClose();
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

  return (
    <div className="space-y-5">
      {/* Action Title */}
      <div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Action Title
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {actionItem.actionText}
        </p>
      </div>

      {/* Action Description */}
      <div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Action Description
        </p>
        <p
          className={`mt-1 whitespace-pre-wrap text-sm ${
            actionItem.actionDescription
              ? "text-zinc-700 dark:text-zinc-300"
              : "italic text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {actionItem.actionDescription || "No description provided"}
        </p>
      </div>

      {/* Detail fields - single column for narrow drawer */}
      <div className="space-y-3">
        <DetailField label="Status">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ACTION_STATUS_COLORS[actionItem.status] ?? ""
            }`}
          >
            {ACTION_STATUS_LABELS[actionItem.status] ?? actionItem.status}
          </span>
        </DetailField>

        <DetailField label="Priority">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PRIORITY_COLORS[actionItem.priority] ?? ""
            }`}
          >
            {PRIORITY_LABELS[actionItem.priority] ?? actionItem.priority}
          </span>
        </DetailField>

        <DetailField label="Assigned Owner">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {actionItem.ownerName ?? "Unassigned"}
          </span>
        </DetailField>

        <DetailField label="Due Date">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {formatDateShort(actionItem.dueDate) ?? "\u2014"}
          </span>
        </DetailField>
      </div>

      {/* Completion Notes / Action Taken */}
      <div>
        <label htmlFor="view-completionNotes">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Action Taken
          </span>
        </label>
        {canEdit ? (
          <div className="mt-1">
            <textarea
              id="view-completionNotes"
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Action taken (optional)"
              maxLength={2000}
              rows={2}
              className={inputClass}
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
                    className={btnPrimary}
                  >
                    {loading ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCompletionNotes(actionItem.completionNotes ?? "")
                    }
                    className={btnSecondary}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {actionItem.completionNotes ?? "\u2014"}
          </p>
        )}
      </div>

      {/* Created-by footer */}
      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Created by {actionItem.createdByEmail} on {actionItem.createdAt}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Edit / Delete buttons */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onModeChange("edit")}
            className={btnSecondary}
          >
            Edit
          </button>
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-600 dark:text-red-400">
                Delete this action item?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className={btnDangerFilled}
              >
                {loading ? "Deleting..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={btnDanger}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Mode
// ---------------------------------------------------------------------------

function EditMode({
  actionItem,
  rcfaId,
  onModeChange,
}: {
  actionItem: ActionItemData;
  rcfaId: string;
  onModeChange: (mode: DrawerMode) => void;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);

  const [actionText, setActionText] = useState(actionItem.actionText);
  const [actionDescription, setActionDescription] = useState(
    actionItem.actionDescription ?? ""
  );
  const [priority, setPriority] = useState(actionItem.priority as string);
  const [editStatus, setEditStatus] = useState(actionItem.status as string);
  const [dueDate, setDueDate] = useState(actionItem.dueDate ?? "");
  const [ownerUserId, setOwnerUserId] = useState(
    actionItem.ownerUserId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { users, loading: loadingUsers } = useUsers(true);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/rcfa/${rcfaId}/action-items/finals/${actionItem.actionItemId}`,
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

      router.refresh();
      onModeChange("view");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update action item"
      );
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  function handleCancel() {
    onModeChange("view");
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Action Title */}
      <div>
        <label htmlFor="edit-actionText" className={labelClass}>
          Action Title <span className="text-red-500">*</span>
        </label>
        <textarea
          id="edit-actionText"
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
          required
          maxLength={2000}
          rows={2}
          className={inputClass}
        />
      </div>

      {/* Action Description */}
      <div>
        <label htmlFor="edit-actionDescription" className={labelClass}>Action Description</label>
        <textarea
          id="edit-actionDescription"
          value={actionDescription}
          onChange={(e) => setActionDescription(e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Detailed explanation of the action..."
          className={inputClass}
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="edit-priority" className={labelClass}>Priority</label>
        <select
          id="edit-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={inputClass}
        >
          {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="edit-status" className={labelClass}>Status</label>
        <select
          id="edit-status"
          value={editStatus}
          onChange={(e) => setEditStatus(e.target.value)}
          className={inputClass}
        >
          {(Object.entries(ACTION_STATUS_LABELS) as [ActionItemStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Assigned Owner */}
      <div>
        <label htmlFor="edit-ownerUserId" className={labelClass}>Assigned Owner</label>
        <select
          id="edit-ownerUserId"
          value={ownerUserId}
          onChange={(e) => setOwnerUserId(e.target.value)}
          disabled={loadingUsers}
          className={inputClass}
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

      {/* Due Date */}
      <DateInput label="Due Date" value={dueDate} onChange={setDueDate} minToday />

      {/* Error */}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={handleCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Mode
// ---------------------------------------------------------------------------

function AddMode({
  rcfaId,
  onClose,
}: {
  rcfaId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const pendingRef = useRef(false);

  const [actionText, setActionText] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { users, loading: loadingUsers } = useUsers(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rcfa/${rcfaId}/action-items/finals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionText,
          actionDescription: actionDescription || null,
          priority,
          dueDate: dueDate || null,
          ownerUserId: ownerUserId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add action item");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add action item"
      );
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Action Title */}
      <div>
        <label htmlFor="add-actionText" className={labelClass}>
          Action Title <span className="text-red-500">*</span>
        </label>
        <textarea
          id="add-actionText"
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
          required
          maxLength={2000}
          rows={2}
          placeholder="Short, action-oriented title"
          className={inputClass}
        />
      </div>

      {/* Action Description */}
      <div>
        <label htmlFor="add-actionDescription" className={labelClass}>Action Description</label>
        <textarea
          id="add-actionDescription"
          value={actionDescription}
          onChange={(e) => setActionDescription(e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Detailed explanation of the action (optional)"
          className={inputClass}
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="add-priority" className={labelClass}>Priority</label>
        <select
          id="add-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={inputClass}
        >
          {(Object.entries(PRIORITY_LABELS) as [Priority, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Assigned Owner */}
      <div>
        <label htmlFor="add-ownerUserId" className={labelClass}>Assigned Owner</label>
        <select
          id="add-ownerUserId"
          value={ownerUserId}
          onChange={(e) => setOwnerUserId(e.target.value)}
          disabled={loadingUsers}
          className={inputClass}
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

      {/* Due Date */}
      <DateInput label="Due Date" value={dueDate} onChange={setDueDate} minToday />

      {/* Error */}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onClose} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
