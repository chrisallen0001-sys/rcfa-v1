import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import {
  formatRcfaNumber,
  formatActionItemNumber,
  RCFA_STATUS_LABELS,
  RCFA_STATUS_COLORS,
} from "@/lib/rcfa-utils";
import { NewRcfaButton } from "@/components/NewRcfaButton";
import Link from "next/link";
import type { Metadata } from "next";
import type {
  RcfaStatus,
  Priority,
  ActionItemStatus,
} from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "Home – RCFA",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  deprioritized: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  deprioritized: "Deprioritized",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const ACTION_STATUS_COLORS: Record<ActionItemStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  canceled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

const ACTION_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Complete",
  canceled: "Canceled",
};

type MyRcfa = {
  id: string;
  rcfaNumber: number;
  title: string;
  status: RcfaStatus;
  equipmentDescription: string;
  createdAt: Date;
};

type MyActionItem = {
  id: string;
  actionItemNumber: number;
  actionText: string;
  status: ActionItemStatus;
  priority: Priority;
  dueDate: Date | null;
  rcfaId: string;
  rcfaNumber: number;
  rcfaTitle: string;
};

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
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
  );
}

function formatDueDate(date: Date | null): string {
  if (!date) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getDueDateColor(date: Date | null): string {
  if (!date) return "text-zinc-500 dark:text-zinc-400";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(date);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return "text-red-600 dark:text-red-400 font-medium";
  if (diffDays <= 2) return "text-amber-600 dark:text-amber-400";
  return "text-zinc-500 dark:text-zinc-400";
}

export default async function HomePage() {
  const { displayName, userId } = await getAuthContext();
  const firstName = displayName.split(" ")[0];

  // Fetch user's open RCFAs and action items in parallel
  const [myRcfas, myActionItems] = await Promise.all([
    prisma.rcfa.findMany({
      where: {
        ownerUserId: userId,
        status: { not: "closed" },
        deletedAt: null,
      },
      select: {
        id: true,
        rcfaNumber: true,
        title: true,
        status: true,
        equipmentDescription: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.rcfaActionItem.findMany({
      where: {
        ownerUserId: userId,
        status: { in: ["open", "in_progress", "blocked"] },
        rcfa: { deletedAt: null },
      },
      select: {
        id: true,
        actionItemNumber: true,
        actionText: true,
        status: true,
        priority: true,
        dueDate: true,
        rcfa: {
          select: {
            id: true,
            rcfaNumber: true,
            title: true,
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 10,
    }),
  ]);

  const rcfaRows: MyRcfa[] = myRcfas;
  const actionItemRows: MyActionItem[] = myActionItems.map((item) => ({
    id: item.id,
    actionItemNumber: item.actionItemNumber,
    actionText: item.actionText,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate,
    rcfaId: item.rcfa.id,
    rcfaNumber: item.rcfa.rcfaNumber,
    rcfaTitle: item.rcfa.title || "Untitled RCFA",
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your personalized dashboard for RCFAs and action items.
          </p>
        </div>
        <NewRcfaButton />
      </div>

      {/* Quick navigation */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/rcfas"
          className="group rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
              All RCFAs
            </h2>
            <ChevronRightIcon />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            View and manage all Root Cause Failure Analyses
          </p>
        </Link>

        <Link
          href="/dashboard/action-items"
          className="group rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
              All Action Items
            </h2>
            <ChevronRightIcon />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Track and complete action items across all RCFAs
          </p>
        </Link>
      </div>

      {/* My Open RCFAs */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My Open RCFAs
          </h2>
          {rcfaRows.length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {rcfaRows.length} open
            </span>
          )}
        </div>

        {rcfaRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You have no open RCFAs assigned to you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rcfaRows.map((rcfa) => (
              <Link
                key={rcfa.id}
                href={`/dashboard/rcfa/${rcfa.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {formatRcfaNumber(rcfa.rcfaNumber)}
                      </span>
                      <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {rcfa.title || "Untitled RCFA"}
                      </h3>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {rcfa.equipmentDescription}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RCFA_STATUS_COLORS[rcfa.status]}`}
                  >
                    {RCFA_STATUS_LABELS[rcfa.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My Open Action Items */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My Open Action Items
          </h2>
          {actionItemRows.length > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {actionItemRows.length} open
            </span>
          )}
        </div>

        {actionItemRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You have no open action items assigned to you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionItemRows.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/dashboard/rcfa/${item.rcfaId}?expandItem=${item.id}`}
                        className="shrink-0 font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {formatActionItemNumber(item.actionItemNumber)}
                      </Link>
                      <p
                        className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                        title={item.actionText}
                      >
                        {item.actionText}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/dashboard/rcfa/${item.rcfaId}`}
                        className="text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-300"
                      >
                        {formatRcfaNumber(item.rcfaNumber)} · {item.rcfaTitle}
                      </Link>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className={getDueDateColor(item.dueDate)}>
                        {formatDueDate(item.dueDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}
                    >
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STATUS_COLORS[item.status]}`}
                    >
                      {ACTION_STATUS_LABELS[item.status]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
