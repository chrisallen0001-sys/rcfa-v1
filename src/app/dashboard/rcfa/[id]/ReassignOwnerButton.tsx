"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  displayName: string;
};

type Props = {
  rcfaId: string;
  currentOwnerId: string;
  currentOwnerName: string;
};

export default function ReassignOwnerButton({
  rcfaId,
  currentOwnerId,
  currentOwnerName,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(currentOwnerId);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && users.length === 0) {
      setIsFetchingUsers(true);
      fetch("/api/users")
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch users");
          }
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setUsers(data);
          } else if (data.error) {
            setError(data.error);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load users");
        })
        .finally(() => {
          setIsFetchingUsers(false);
        });
    }
  }, [isOpen, users.length]);

  async function handleSubmit() {
    if (selectedUserId === currentOwnerId) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rcfa/${rcfaId}/owner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerUserId: selectedUserId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reassign owner");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        Reassign Owner
      </button>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Reassign RCFA Owner
      </h3>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Current owner: {currentOwnerName}
      </p>

      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {isFetchingUsers ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading users...
        </p>
      ) : users.length === 0 && !error ? (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          No users available
        </p>
      ) : (
        <>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="mb-3 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            disabled={isLoading || users.length === 0}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
                {user.id === currentOwnerId ? " (current)" : ""}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isLoading || selectedUserId === currentOwnerId || users.length === 0}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setSelectedUserId(currentOwnerId);
                setError(null);
              }}
              disabled={isLoading}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
