import type { Metadata } from "next";
import { Suspense } from "react";
import { NewRcfaButton } from "@/components/NewRcfaButton";
import RcfaTable from "./RcfaTable";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RCFAs – RCFA",
};

/**
 * @deprecated This type is kept for backwards compatibility with RcfaListFilter.
 * Use RcfaTableRow from RcfaTable.tsx for new code.
 */
export type RcfaRow = {
  id: string;
  rcfaNumber: number;
  title: string;
  equipmentDescription: string;
  status: "draft" | "investigation" | "actions_open" | "closed";
  createdAt: string;
  ownerDisplayName: string;
  rootCauseCount: number;
  actionItemCount: number;
  openActionCount: number;
  equipmentHighlight?: string;
  failureHighlight?: string;
};

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="h-12 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-zinc-200 last:border-b-0 dark:border-zinc-800" />
        ))}
      </div>
    </div>
  );
}

export default async function RcfasPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            RCFAs
          </h1>
          <Link
            href="/dashboard/action-items"
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            View Action Items →
          </Link>
        </div>
        <NewRcfaButton />
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <RcfaTable initialFilter={filter} />
      </Suspense>
    </div>
  );
}
