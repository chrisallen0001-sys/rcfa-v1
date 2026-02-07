"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

/**
 * Button that creates a new RCFA via the API and redirects to the detail page.
 * Shows a confirmation dialog before creating to prevent accidental record creation.
 */
export function NewRcfaButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!showModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isCreating) {
        setShowModal(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showModal, isCreating]);

  // Handle click outside modal to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isCreating) {
        setShowModal(false);
      }
    }
    if (showModal) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModal, isCreating]);

  async function handleCreate() {
    if (isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/rcfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create RCFA");
      }

      const { id } = await res.json();
      router.push(`/dashboard/rcfa/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create RCFA");
      setIsCreating(false);
    }
  }

  function handleOpenModal() {
    setError(null);
    setShowModal(true);
  }

  function handleCloseModal() {
    if (!isCreating) {
      setShowModal(false);
      setError(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        New RCFA
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            ref={modalRef}
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Create New RCFA?
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              A new RCFA record will be created and assigned to you.
            </p>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isCreating}
                autoFocus
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
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
                    Creating...
                  </span>
                ) : (
                  "Create RCFA"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
