"use client";

import { useState } from "react";
import Link from "next/link";
import type { RcfaStatus } from "@/generated/prisma/client";
import { formatRcfaNumber } from "@/lib/rcfa-utils";

type RcfaRow = {
  id: string;
  rcfaNumber: number;
  title: string;
  equipmentDescription: string;
  status: RcfaStatus;
  createdAt: string;
  ownerDisplayName: string;
  rootCauseCount: number;
  actionItemCount: number;
  openActionCount: number;
  equipmentHighlight?: string;
  failureHighlight?: string;
};

type Props = {
  items: RcfaRow[];
  statusLabels: Record<RcfaStatus, string>;
  statusColors: Record<RcfaStatus, string>;
  /** When true, status filter buttons are hidden (search results shown as-is). */
  isSearching?: boolean;
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
  isSearching = false,
}: Props) {
  const [filter, setFilter] = useState<RcfaStatus | "all">("all");

  const filtered =
    isSearching || filter === "all"
      ? items
      : items.filter((r) => r.status === filter);

  const btnClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    }`;

  return (
    <>
      {!isSearching && (
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
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {isSearching
            ? "No RCFAs match your search."
            : items.length === 0
              ? "No RCFAs yet. Click 'New RCFA' to get started."
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
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {formatRcfaNumber(r.rcfaNumber)}
                    </span>
                    <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {r.title}
                    </h2>
                  </div>
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

              {/* Search highlight snippets */}
              {isSearching && (r.equipmentHighlight || r.failureHighlight) && (
                <div className="mt-2 space-y-1 rounded border border-zinc-100 bg-zinc-50 p-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  {r.equipmentHighlight && (
                    <p>
                      <span className="font-medium text-zinc-500 dark:text-zinc-500">
                        Equipment:{" "}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: r.equipmentHighlight,
                        }}
                      />
                    </p>
                  )}
                  {r.failureHighlight && (
                    <p>
                      <span className="font-medium text-zinc-500 dark:text-zinc-500">
                        Failure:{" "}
                      </span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: r.failureHighlight,
                        }}
                      />
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Owner: {r.ownerDisplayName}</span>
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
