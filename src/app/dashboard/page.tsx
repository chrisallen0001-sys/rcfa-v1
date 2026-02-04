import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth-context";
import type { RcfaStatus } from "@/generated/prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import RcfaListFilter from "./RcfaListFilter";
import SearchInput from "./SearchInput";
import LogoutButton from "./LogoutButton";

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

type SummaryRow = {
  id: string;
  title: string;
  equipment_description: string;
  status: RcfaStatus;
  created_at: Date;
  final_root_cause_count: bigint;
  action_item_count: bigint;
  open_action_item_count: bigint;
  total_count: bigint;
};

type SearchResultRow = SummaryRow & {
  equip_headline: string;
  failure_headline: string;
  rank: number;
};

/**
 * HTML-escape a string, then replace neutral highlight delimiters with <mark>.
 * This ensures no raw HTML from the DB ever reaches the client.
 */
function sanitizeHighlight(raw: string): string {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped
    .replace(/\[\[HL\]\]/g, "<mark>")
    .replace(/\[\[\/HL\]\]/g, "</mark>");
}

async function searchRcfas(
  query: string,
  userId: string,
  isAdmin: boolean,
  pageNum: number,
): Promise<{ rows: RcfaRow[]; total: number }> {
  // Params: [query, owner (null for admin), limit, offset] => $1, $2, $3, $4
  const offset = (pageNum - 1) * ITEMS_PER_PAGE;
  const ownerParam = isAdmin ? null : userId;
  const params: (string | number | null)[] = [
    query,
    ownerParam,
    ITEMS_PER_PAGE,
    offset,
  ];

  // Use a CTE so we can count total matches while also returning ranked rows.
  // Note: equipment_description and failure_description are NOT NULL by schema
  // constraint, so COALESCE is unnecessary for to_tsvector calls.
  // Tautology WHERE ($2::uuid IS NULL OR ...) lets admins see all rows without
  // conditional SQL string building.
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
          'StartSel=[[HL]], StopSel=[[/HL]], MaxFragments=1, MaxWords=30') AS equip_headline,
        ts_headline('english', r.failure_description, plainto_tsquery('english', $1),
          'StartSel=[[HL]], StopSel=[[/HL]], MaxFragments=1, MaxWords=30') AS failure_headline
      FROM rcfa r
      WHERE (
        to_tsvector('english', r.equipment_description) ||
        to_tsvector('english', r.failure_description)
      ) @@ plainto_tsquery('english', $1)
      AND ($2::uuid IS NULL OR r.created_by_user_id = $2::uuid)
      AND r.deleted_at IS NULL
    )
    SELECT
      m.*,
      COUNT(*) OVER() AS total_count,
      s.final_root_cause_count,
      s.action_item_count,
      s.open_action_item_count
    FROM matches m
    JOIN rcfa_summary s ON s.id = m.id
    ORDER BY m.rank DESC, m.created_at DESC
    LIMIT $3 OFFSET $4
  `;
  const results = await prisma.$queryRawUnsafe<SearchResultRow[]>(
    sql,
    ...params,
  );

  const total = results.length > 0 ? Number(results[0].total_count) : 0;

  const rows: RcfaRow[] = results.map((r) => ({
    id: r.id,
    title: r.title || "Untitled RCFA",
    equipmentDescription: r.equipment_description,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
    rootCauseCount: Number(r.final_root_cause_count),
    actionItemCount: Number(r.action_item_count),
    openActionCount: Number(r.open_action_item_count),
    equipmentHighlight: sanitizeHighlight(r.equip_headline),
    failureHighlight: sanitizeHighlight(r.failure_headline),
  }));

  return { rows, total };
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
  let searchTotal = 0;

  if (searchQuery) {
    const result = await searchRcfas(searchQuery, userId, isAdmin, pageNum);
    rows = result.rows;
    searchTotal = result.total;
    totalPages = Math.max(1, Math.ceil(result.total / ITEMS_PER_PAGE));
  } else {
    // Use a tautology WHERE clause so the query shape is always the same:
    // pass null for admins (matches all rows), or the userId for non-admins.
    const ownerParam = isAdmin ? null : userId;
    const browseParams: (string | number | null)[] = [
      ITEMS_PER_PAGE,
      (pageNum - 1) * ITEMS_PER_PAGE,
      ownerParam,
    ];

    const browseSql = `
      SELECT
        s.id,
        s.title,
        s.equipment_description,
        s.status,
        s.created_at,
        s.final_root_cause_count,
        s.action_item_count,
        s.open_action_item_count,
        COUNT(*) OVER() AS total_count
      FROM rcfa_summary s
      WHERE ($3::uuid IS NULL OR s.created_by_user_id = $3::uuid)
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const browseResults = await prisma.$queryRawUnsafe<SummaryRow[]>(
      browseSql,
      ...browseParams,
    );

    const total = browseResults.length > 0 ? Number(browseResults[0].total_count) : 0;
    totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

    rows = browseResults.map((r) => ({
      id: r.id,
      title: r.title || "Untitled RCFA",
      equipmentDescription: r.equipment_description,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString().slice(0, 10),
      rootCauseCount: Number(r.final_root_cause_count),
      actionItemCount: Number(r.action_item_count),
      openActionCount: Number(r.open_action_item_count),
    }));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          RCFAs
        </h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/dashboard/admin/users"
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              User Management
            </Link>
          )}
          <Link
            href="/dashboard/action-items"
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Action Items
          </Link>
          <Link
            href="/dashboard/intake"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New RCFA
          </Link>
          <LogoutButton />
        </div>
      </div>
      <Suspense>
        <SearchInput />
      </Suspense>
      {searchQuery && (
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          {searchTotal} result{searchTotal !== 1 ? "s" : ""} for &ldquo;
          {searchQuery}&rdquo;
        </p>
      )}
      <RcfaListFilter
        items={rows}
        statusLabels={STATUS_LABELS}
        statusColors={STATUS_COLORS}
        isSearching={!!searchQuery}
      />
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2">
          {pageNum > 1 && (
            <Link
              href={`/dashboard?page=${pageNum - 1}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
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
              href={`/dashboard?page=${pageNum + 1}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`}
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
