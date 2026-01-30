"use client";

import { useState } from "react";
import Link from "next/link";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { ActionItemRow } from "./page";

type Props = {
  items: ActionItemRow[];
  currentUserId: string;
  priorityLabels: Record<Priority, string>;
  priorityColors: Record<Priority, string>;
  statusLabels: Record<ActionItemStatus, string>;
  statusColors: Record<ActionItemStatus, string>;
};

export default function ActionItemsFilter({
  items,
  currentUserId,
  priorityLabels,
  priorityColors,
  statusLabels,
  statusColors,
}: Props) {
  const [filter, setFilter] = useState<"mine" | "all">("mine");

  const filtered =
    filter === "mine"
      ? items.filter((i) => i.ownerUserId === currentUserId)
      : items;

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter("mine")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "mine"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          Assigned to me
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No action items found.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.actionText}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[item.priority]}`}
                  >
                    {priorityLabels[item.priority]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status]}`}
                  >
                    {statusLabels[item.status]}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Link
                  href={`/dashboard/rcfa/${item.rcfaId}`}
                  className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {item.rcfaTitle}
                </Link>
                {item.dueDate && <span>Due: {item.dueDate}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
