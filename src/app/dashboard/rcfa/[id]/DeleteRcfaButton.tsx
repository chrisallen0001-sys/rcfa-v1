"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteRcfaButtonProps {
  rcfaId: string;
  rcfaTitle: string;
}

export default function DeleteRcfaButton({
  rcfaId,
  rcfaTitle,
}: DeleteRcfaButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function handleClick() {
    if (pendingRef.current) return;

    const displayTitle = rcfaTitle || "this RCFA";
    const ok = window.confirm(
      `Are you sure you want to permanently delete "${displayTitle}"?\n\nThis action cannot be undone. All related data (root causes, action items, etc.) will also be deleted.`
    );
    if (!ok) return;

    pendingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rcfa/${rcfaId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete RCFA");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete RCFA");
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Deleting...
          </span>
        ) : (
          "Delete RCFA"
        )}
      </button>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
