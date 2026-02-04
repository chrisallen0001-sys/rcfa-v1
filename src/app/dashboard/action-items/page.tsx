import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { Priority, ActionItemStatus } from "@/generated/prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import ActionItemsFilter from "./ActionItemsFilter";

export const metadata: Metadata = {
  title: "Action Items – RCFA",
};

const ITEMS_PER_PAGE = 50;

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

export type UserOption = {
  id: string;
  displayName: string;
};

export default async function ActionItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId } = await getAuthContext();
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const where = { rcfa: { createdByUserId: userId, deletedAt: null } } as const;

  const [items, total, users] = await Promise.all([
    prisma.rcfaActionItem.findMany({
      where,
      skip: (pageNum - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      include: {
        rcfa: { select: { id: true, title: true } },
        owner: { select: { id: true, email: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    }),
    prisma.rcfaActionItem.count({ where }),
    prisma.appUser.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

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
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Dashboard
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Action Items
      </h1>
      <ActionItemsFilter
        items={rows}
        totalItems={total}
        currentUserId={userId}
        users={users}
        priorityLabels={PRIORITY_LABELS}
        priorityColors={PRIORITY_COLORS}
        statusLabels={STATUS_LABELS}
      />
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2">
          {pageNum > 1 && (
            <Link
              href={`/dashboard/action-items?page=${pageNum - 1}`}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={`/dashboard/action-items?page=${pageNum + 1}`}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
