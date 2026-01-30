"use client";

import { useState } from "react";
import Link from "next/link";
import type { RcfaStatus } from "@/generated/prisma/client";
import type { RcfaRow } from "./page";

type Props = {
  items: RcfaRow[];
  statusLabels: Record<RcfaStatus, string>;
  statusColors: Record<RcfaStatus, string>;
};

const ALL_STATUSES: RcfaStatus[] = [
  "draft",
  "investigation",
  "actions_open",
  "closed",
];

export default function RcfaListFilter({
  items,
  statusLabels,
  statusColors,
}: Props) {
  const [filter, setFilter] = useState<RcfaStatus | "all">("all");

  const filtered =
    filter === "all" ? items : items.filter((r) => r.status === filter);

  const btnClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    }`;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={btnClass(filter === "all")}
        >
          All ({items.length})
        </button>
        {ALL_STATUSES.map((s) => {
          const count = items.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={btnClass(filter === s)}
            >
              {statusLabels[s]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {items.length === 0
            ? "No RCFAs yet. Create one from the intake form to get started."
            : "No RCFAs match the selected filter."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/rcfa/${r.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {r.title}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {r.equipmentDescription}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[r.status]}`}
                >
                  {statusLabels[r.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Created {r.createdAt}</span>
                <span>
                  {r.rootCauseCount} root{" "}
                  {r.rootCauseCount === 1 ? "cause" : "causes"}
                </span>
                <span>
                  {r.actionItemCount} action{" "}
                  {r.actionItemCount === 1 ? "item" : "items"}
                </span>
                {r.openActionCount > 0 && (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {r.openActionCount} open
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
