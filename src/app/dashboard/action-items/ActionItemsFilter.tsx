"use client";

import { useState } from "react";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { ActionItemRow, UserOption } from "./page";
import ActionItemCard from "./ActionItemCard";

type Props = {
  items: ActionItemRow[];
  totalItems: number;
  currentUserId: string;
  users: UserOption[];
  priorityLabels: Record<Priority, string>;
  priorityColors: Record<Priority, string>;
  statusLabels: Record<ActionItemStatus, string>;
  statusColors: Record<ActionItemStatus, string>;
};

export default function ActionItemsFilter({
  items,
  totalItems,
  currentUserId,
  users,
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
          Assigned to me
        </button>
        <button onClick={() => setFilter("all")} className={btnClass(filter === "all")}>
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalItems === 0
            ? "No action items yet. Create an RCFA to get started."
            : "No action items match the current filter."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ActionItemCard
              key={item.id}
              item={item}
              users={users}
              priorityLabels={priorityLabels}
              priorityColors={priorityColors}
              statusLabels={statusLabels}
              statusColors={statusColors}
            />
          ))}
        </div>
      )}
    </>
  );
}
