"use client";

import { useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
};

export default function UserManagement({
  initialUsers,
}: {
  initialUsers: User[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
      { ...created, createdAt: new Date().toISOString().slice(0, 10) },
    ]);
    setShowForm(false);
    setSaving(false);
    form.reset();
  }

  async function handleToggleRole(user: User) {
    setTogglingId(user.id);
    const newRole = user.role === "admin" ? "user" : "admin";

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u))
      );
    }
    setTogglingId(null);
  }

  return (
    <>
      {/* User table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
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
                Created
              </th>
              <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {users.map((user) => (
              <tr
                key={user.id}
                className="bg-white dark:bg-zinc-900"
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {user.displayName}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  {user.createdAt}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleRole(user)}
                    disabled={togglingId === user.id}
                    className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {togglingId === user.id
                      ? "Saving..."
                      : user.role === "admin"
                        ? "Demote to user"
                        : "Promote to admin"}
                  </button>
                </td>
              </tr>
            ))}
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
