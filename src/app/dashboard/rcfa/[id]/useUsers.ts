"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type User = {
  id: string;
  displayName: string;
};

// Module-level store for users cache
let cachedUsers: User[] = [];
const listeners: Set<() => void> = new Set();
let fetchInProgress = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedUsers;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

async function fetchUsers() {
  if (fetchInProgress || cachedUsers.length > 0) return;

  fetchInProgress = true;
  try {
    const res = await fetch("/api/users");
    if (!res.ok) {
      console.error("Failed to fetch users: HTTP", res.status);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      cachedUsers = data;
      notifyListeners();
    } else {
      console.error("Unexpected users response format:", data);
    }
  } catch (err) {
    console.error("Failed to fetch users:", err);
  } finally {
    fetchInProgress = false;
  }
}

/**
 * Hook that fetches and caches the list of users for assignment dropdowns.
 * Calls GET /api/users with no status param, which defaults to active-only,
 * so only active users appear in owner-assignment selects.
 * Uses a module-level cache to prevent duplicate API calls when multiple
 * components need the users list.
 *
 * @param shouldFetch - Whether to trigger the fetch (e.g., when form opens)
 * @returns Object containing users array and loading state
 */
export function useUsers(shouldFetch: boolean) {
  const users = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const loadingRef = useRef(false);

  const triggerFetch = useCallback(() => {
    if (shouldFetch && cachedUsers.length === 0 && !fetchInProgress) {
      loadingRef.current = true;
      fetchUsers().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [shouldFetch]);

  // Trigger fetch on mount if shouldFetch is true
  useEffect(() => {
    triggerFetch();
  }, [triggerFetch]);

  // Loading is true if fetch is in progress AND we don't have data yet
  const loading = fetchInProgress && cachedUsers.length === 0;

  return { users, loading };
}
