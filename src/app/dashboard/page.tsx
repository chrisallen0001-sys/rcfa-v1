import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { RcfaStatus } from "@/generated/prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import RcfaListFilter from "./RcfaListFilter";
import SearchInput from "./SearchInput";

export const metadata: Metadata = {
  title: "Dashboard – RCFA",
};

const ITEMS_PER_PAGE = 50;

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
  /** FTS headline snippet for equipment_description (only present when searching) */
  equipmentHighlight?: string;
  /** FTS headline snippet for failure_description (only present when searching) */
  failureHighlight?: string;
};

type SearchResultRow = {
  id: string;
  title: string;
  equipment_description: string;
  status: RcfaStatus;
  created_at: Date;
  root_cause_count: bigint;
  action_item_count: bigint;
  open_action_count: bigint;
  equip_headline: string;
  failure_headline: string;
  rank: number;
};

async function searchRcfas(
  query: string,
  userId: string,
  isAdmin: boolean,
): Promise<{ rows: RcfaRow[]; total: number }> {
  const ownerClause = isAdmin ? "" : "AND r.created_by_user_id = $2::uuid";
  const params = isAdmin ? [query] : [query, userId];

  // Use a CTE so we can count total matches while also returning ranked rows
  const sql = `
    WITH matches AS (
      SELECT
        r.id,
        r.title,
        r.equipment_description,
        r.status,
        r.created_at,
        ts_rank(
          to_tsvector('english', r.equipment_description) ||
          to_tsvector('english', r.failure_description),
          plainto_tsquery('english', $1)
        ) AS rank,
        ts_headline('english', r.equipment_description, plainto_tsquery('english', $1),
          'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=30') AS equip_headline,
        ts_headline('english', r.failure_description, plainto_tsquery('english', $1),
          'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=30') AS failure_headline
      FROM rcfa r
      WHERE (
        to_tsvector('english', r.equipment_description) ||
        to_tsvector('english', r.failure_description)
      ) @@ plainto_tsquery('english', $1)
      ${ownerClause}
    )
    SELECT
      m.*,
      (SELECT count(*) FROM rcfa_root_cause_final f WHERE f.rcfa_id = m.id) AS root_cause_count,
      (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = m.id) AS action_item_count,
      (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = m.id AND a.status IN ('open','in_progress','blocked')) AS open_action_count
    FROM matches m
    ORDER BY m.rank DESC, m.created_at DESC
    LIMIT ${ITEMS_PER_PAGE}
  `;

  // Prisma.$queryRawUnsafe is needed here because the owner clause is
  // conditionally included. The user-supplied search query is always passed as
  // a positional parameter ($1) -- never interpolated -- so this is safe from
  // SQL injection.
  const results = await prisma.$queryRawUnsafe<SearchResultRow[]>(
    sql,
    ...params,
  );

  const rows: RcfaRow[] = results.map((r) => ({
    id: r.id,
    title: r.title || "Untitled RCFA",
    equipmentDescription: r.equipment_description,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
    rootCauseCount: Number(r.root_cause_count),
    actionItemCount: Number(r.action_item_count),
    openActionCount: Number(r.open_action_count),
    equipmentHighlight: r.equip_headline,
    failureHighlight: r.failure_headline,
  }));

  return { rows, total: rows.length };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { userId, role } = await getAuthContext();
  const { page, q } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const searchQuery = q?.trim() ?? "";

  const isAdmin = role === "admin";

  let rows: RcfaRow[];
  let totalPages: number;

  if (searchQuery) {
    const result = await searchRcfas(searchQuery, userId, isAdmin);
    rows = result.rows;
    totalPages = 1; // search results are capped at ITEMS_PER_PAGE
  } else {
    const where = isAdmin ? {} : { createdByUserId: userId };

    const [rcfas, total] = await Promise.all([
      prisma.rcfa.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * ITEMS_PER_PAGE,
        take: ITEMS_PER_PAGE,
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
      }),
      prisma.rcfa.count({ where }),
    ]);

    totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

    rows = rcfas.map((r) => ({
      id: r.id,
      title: r.title || "Untitled RCFA",
      equipmentDescription: r.equipmentDescription,
      status: r.status,
      createdAt: r.createdAt.toISOString().slice(0, 10),
      rootCauseCount: r._count.rootCauseFinals,
      actionItemCount: r._count.actionItems,
      openActionCount: r.actionItems.length,
    }));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        RCFAs
      </h1>
      <Suspense>
        <SearchInput />
      </Suspense>
      {searchQuery && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          {rows.length} result{rows.length !== 1 ? "s" : ""} for &ldquo;
          {searchQuery}&rdquo;
        </p>
      )}
      <RcfaListFilter
        items={rows}
        statusLabels={STATUS_LABELS}
        statusColors={STATUS_COLORS}
        isSearching={!!searchQuery}
      />
      {!searchQuery && totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2">
          {pageNum > 1 && (
            <Link
              href={`/dashboard?page=${pageNum - 1}`}
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
              href={`/dashboard?page=${pageNum + 1}`}
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
