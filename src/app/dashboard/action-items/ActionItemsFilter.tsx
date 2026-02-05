"use client";

import { useState } from "react";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { ActionItemRow, UserOption } from "./page";
import ActionItemCard from "./ActionItemCard";

type Props = {
  items: ActionItemRow[];
  totalItems: number;
  mineTotal: number;
  currentUserId: string;
  users: UserOption[];
  priorityLabels: Record<Priority, string>;
  priorityColors: Record<Priority, string>;
  statusLabels: Record<ActionItemStatus, string>;
};

export default function ActionItemsFilter({
  items,
  totalItems,
  mineTotal,
  currentUserId,
  users,
  priorityLabels,
  priorityColors,
  statusLabels,
}: Props) {
  const [filter, setFilter] = useState<"mine" | "all">("mine");

  const filtered =
    filter === "mine"
      ? items.filter((i) => i.ownerUserId === currentUserId)
      : items;

  const btnClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    }`;

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setFilter("mine")} className={btnClass(filter === "mine")}>
          Assigned to me ({mineTotal})
        </button>
        <button onClick={() => setFilter("all")} className={btnClass(filter === "all")}>
          All ({totalItems})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalItems === 0
            ? "No action items yet. Create an RCFA to get started."
            : filter === "mine" && mineTotal === 0
              ? "No action items are assigned to you."
              : "No action items match the current filter."}
        </p>
      ) : (
        <>
          {filtered.length < (filter === "mine" ? mineTotal : totalItems) && (
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Showing {filtered.length} of{" "}
              {filter === "mine" ? mineTotal : totalItems} on this page
            </p>
          )}
          <div className="space-y-3">
            {filtered.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                users={users}
                priorityLabels={priorityLabels}
                priorityColors={priorityColors}
                statusLabels={statusLabels}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
