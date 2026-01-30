import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { RcfaStatus } from "@/generated/prisma/client";
import type { Metadata } from "next";
import RcfaListFilter from "./RcfaListFilter";

export const metadata: Metadata = {
  title: "Dashboard – RCFA",
};

const STATUS_LABELS: Record<RcfaStatus, string> = {
  draft: "Draft",
  investigation: "Investigation",
  actions_open: "Actions Open",
  closed: "Closed",
};

const STATUS_COLORS: Record<RcfaStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  investigation:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  actions_open:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export type RcfaRow = {
  id: string;
  title: string;
  equipmentDescription: string;
  status: RcfaStatus;
  createdAt: string;
  rootCauseCount: number;
  actionItemCount: number;
  openActionCount: number;
};

export default async function DashboardPage() {
  const { userId, role } = await getAuthContext();

  const isAdmin = role === "admin";

  const where = isAdmin ? {} : { createdByUserId: userId };

  const rcfas = await prisma.rcfa.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          rootCauseFinals: true,
          actionItems: true,
        },
      },
      actionItems: {
        where: {
          status: { in: ["open", "in_progress", "blocked"] },
        },
        select: { id: true },
      },
    },
  });

  const rows: RcfaRow[] = rcfas.map((r) => ({
    id: r.id,
    title: r.title || "Untitled RCFA",
    equipmentDescription: r.equipmentDescription,
    status: r.status,
    createdAt: r.createdAt.toISOString().slice(0, 10),
    rootCauseCount: r._count.rootCauseFinals,
    actionItemCount: r._count.actionItems,
    openActionCount: r.actionItems.length,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        RCFAs
      </h1>
      <RcfaListFilter
        items={rows}
        statusLabels={STATUS_LABELS}
        statusColors={STATUS_COLORS}
      />
    </div>
  );
}
