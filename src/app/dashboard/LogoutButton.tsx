"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleLogout() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      // Treat 401 as success - session was already invalid
      if (res.ok || res.status === 401) {
        router.push("/login");
      } else {
        setError(true);
        setLoading(false);
      }
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      title={error ? "Logout failed — try again" : undefined}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
        error
          ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {loading ? "Logging out..." : error ? "Retry Logout" : "Logout"}
    </button>
  );
}
