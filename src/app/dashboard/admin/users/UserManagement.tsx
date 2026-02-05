"use client";

import { useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
};

interface UserManagementProps {
  initialUsers: User[];
  currentUserId: string;
}

export default function UserManagement({
  initialUsers,
  currentUserId,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);
  const [confirmReject, setConfirmReject] = useState<User | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    const form = e.currentTarget;
    const data = new FormData(form);
    const email = (data.get("email") as string).trim();
    const displayName = (data.get("displayName") as string).trim();
    const password = data.get("password") as string;
    const role = data.get("role") as string;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName, password, role }),
    });

    if (!res.ok) {
      const body = await res.json();
      setFormError(body.error || "Failed to create user");
      setSaving(false);
      return;
    }

    const created = await res.json();
    setUsers((prev) => [
      ...prev,
      {
        ...created,
        status: created.status || "active",
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setShowForm(false);
    setSaving(false);
    form.reset();
  }

  async function handleToggleRole(user: User) {
    setTogglingId(user.id);
    setActionError("");
    const newRole = user.role === "admin" ? "user" : "admin";

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, role: updated.role, status: updated.status } : u
        )
      );
    } else {
      const body = await res.json();
      setActionError(body.error || "Failed to update role");
    }
    setTogglingId(null);
  }

  async function handleToggleStatus(user: User) {
    setTogglingId(user.id);
    setActionError("");
    setConfirmDisable(null);
    const newStatus = user.status === "active" ? "disabled" : "active";

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, role: updated.role, status: updated.status } : u
        )
      );
    } else {
      const body = await res.json();
      setActionError(body.error || "Failed to update status");
    }
    setTogglingId(null);
  }

  function handleDisableClick(user: User) {
    if (user.status === "active") {
      setConfirmDisable(user);
    } else {
      handleToggleStatus(user);
    }
  }

  async function handleUpdateStatus(user: User, newStatus: "active" | "disabled", errorMessage: string) {
    setTogglingId(user.id);
    setActionError("");
    setConfirmReject(null);

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, role: updated.role, status: updated.status } : u
        )
      );
    } else {
      const body = await res.json();
      setActionError(body.error || errorMessage);
    }
    setTogglingId(null);
  }

  function handleApprove(user: User) {
    handleUpdateStatus(user, "active", "Failed to approve user");
  }

  function handleRejectClick(user: User) {
    setConfirmReject(user);
  }

  function handleRejectConfirm(user: User) {
    handleUpdateStatus(user, "disabled", "Failed to reject user");
  }

  return (
    <>
      {actionError && (
        <div className="mb-3 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
          <button
            onClick={() => setActionError("")}
            className="ml-2 text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Disable confirmation modal */}
      {confirmDisable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disable-modal-title"
          onKeyDown={(e) => e.key === "Escape" && setConfirmDisable(null)}
        >
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3
              id="disable-modal-title"
              className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
            >
              Disable User Account
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Are you sure you want to disable{" "}
              <span className="font-medium">{confirmDisable.displayName}</span>? They
              will be unable to log in.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDisable(null)}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleStatus(confirmDisable)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation modal */}
      {confirmReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          onKeyDown={(e) => e.key === "Escape" && setConfirmReject(null)}
        >
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3
              id="reject-modal-title"
              className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
            >
              Reject User Registration
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Are you sure you want to reject{" "}
              <span className="font-medium">{confirmReject.displayName}</span>&apos;s
              registration? Their account will be disabled.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmReject(null)}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectConfirm(confirmReject)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Email
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Display Name
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Role
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Status
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Created
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {users.map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const isDisabled = user.status === "disabled";
              const isPending = user.status === "pending_approval";
              const isDimmed = isDisabled || isPending;

              return (
                <tr
                  key={user.id}
                  className={`${
                    isPending
                      ? "bg-amber-50/50 dark:bg-amber-900/10"
                      : isDisabled
                        ? "bg-zinc-50 dark:bg-zinc-900/50"
                        : "bg-white dark:bg-zinc-900"
                  }`}
                >
                  <td
                    className={`px-4 py-3 ${
                      isDimmed
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {user.email}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      isDimmed
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {user.displayName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === "admin"
                          ? isDimmed
                            ? "bg-purple-50 text-purple-400 dark:bg-purple-900/20 dark:text-purple-500"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : isDimmed
                            ? "bg-zinc-50 text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-500"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isPending
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : isDisabled
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}
                    >
                      {isPending ? "Pending" : isDisabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      isDimmed
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {user.createdAt}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleApprove(user)}
                            disabled={togglingId === user.id}
                            className="rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                          >
                            {togglingId === user.id ? "Saving..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleRejectClick(user)}
                            disabled={togglingId === user.id}
                            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            {togglingId === user.id ? "Saving..." : "Reject"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleRole(user)}
                            disabled={togglingId === user.id || isCurrentUser}
                            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            {togglingId === user.id
                              ? "Saving..."
                              : user.role === "admin"
                                ? "Demote"
                                : "Promote"}
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleDisableClick(user)}
                              disabled={togglingId === user.id}
                              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                                isDisabled
                                  ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                                  : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                              }`}
                            >
                              {togglingId === user.id
                                ? "Saving..."
                                : isDisabled
                                  ? "Enable"
                                  : "Disable"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create user */}
      <div className="mt-6">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create User
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Create New User
            </h2>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Display Name
                </label>
                <input
                  name="displayName"
                  type="text"
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue="user"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saving ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
