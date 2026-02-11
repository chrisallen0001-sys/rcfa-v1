import { getAuthContext } from "@/lib/auth-context";
import { NewRcfaButton } from "@/components/NewRcfaButton";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home – RCFA",
};

export default async function HomePage() {
  const { displayName } = await getAuthContext();
  const firstName = displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your personalized dashboard for RCFAs and action items.
        </p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/rcfas"
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              RCFAs
            </h2>
            <svg
              className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            View and manage all Root Cause Failure Analyses
          </p>
        </Link>

        <Link
          href="/dashboard/action-items"
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Action Items
            </h2>
            <svg
              className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1 dark:text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Track and complete action items across all RCFAs
          </p>
        </Link>
      </div>

      {/* Placeholder for personalized content - will be implemented in #303 */}
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your personalized dashboard with open RCFAs and action items is coming soon.
        </p>
        <div className="mt-4">
          <NewRcfaButton />
        </div>
      </div>
    </div>
  );
}
