import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import ActionItemsFilter from "./ActionItemsFilter";

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
  canceled: "Canceled",
};

const STATUS_COLORS: Record<ActionItemStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  canceled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export type ActionItemRow = {
  id: string;
  actionText: string;
  priority: Priority;
  status: ActionItemStatus;
  dueDate: string | null;
  ownerUserId: string | null;
  rcfaId: string;
  rcfaTitle: string;
};

export default async function ActionItemsPage() {
  const { userId } = await getAuthContext();

  const items = await prisma.rcfaActionItem.findMany({
    include: {
      rcfa: { select: { id: true, title: true } },
      owner: { select: { id: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
  });

  const rows: ActionItemRow[] = items.map((item) => ({
    id: item.id,
    actionText: item.actionText,
    priority: item.priority,
    status: item.status,
    dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
    ownerUserId: item.ownerUserId,
    rcfaId: item.rcfa.id,
    rcfaTitle: item.rcfa.title ?? "Untitled RCFA",
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Action Items
      </h1>
      <ActionItemsFilter
        items={rows}
        currentUserId={userId}
        priorityLabels={PRIORITY_LABELS}
        priorityColors={PRIORITY_COLORS}
        statusLabels={STATUS_LABELS}
        statusColors={STATUS_COLORS}
      />
    </div>
  );
}
