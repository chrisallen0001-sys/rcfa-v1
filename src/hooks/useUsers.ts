"use client";

import { useState, useEffect } from "react";

export type User = {
  id: string;
  displayName: string;
};

// Module-level cache for users list (rarely changes during a session)
let usersCache: User[] | null = null;
let usersFetchPromise: Promise<User[]> | null = null;

/**
 * Hook to fetch and cache the users list for owner dropdowns.
 * Uses module-level caching to avoid refetching across component instances.
 */
export function useUsers(): User[] {
  // Initialize from cache if available
  const [users, setUsers] = useState<User[]>(usersCache ?? []);

  useEffect(() => {
    // Skip fetch if we already have cached data
    if (usersCache) return;

    if (!usersFetchPromise) {
      usersFetchPromise = fetch("/api/users")
        .then((res) => res.json())
        .then((data: User[]) => {
          usersCache = data;
          return data;
        })
        .catch((err) => {
          console.error("Failed to fetch users:", err);
          usersFetchPromise = null;
          return [];
        });
    }

    usersFetchPromise.then(setUsers);
  }, []);

  return users;
}
