import { prisma } from "@/lib/prisma";
import { RCFA_STATUS_LABELS, RCFA_STATUS_COLORS } from "@/lib/rcfa-utils";
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

export type RcfaRow = {
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
  /** FTS headline snippet for equipment_description (only present when searching) */
  equipmentHighlight?: string;
  /** FTS headline snippet for failure_description (only present when searching) */
  failureHighlight?: string;
};

type SummaryRow = {
  id: string;
  rcfa_number: number;
  title: string;
  equipment_description: string;
  status: RcfaStatus;
  created_at: Date;
  owner_display_name: string;
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
  pageNum: number,
): Promise<{ rows: RcfaRow[]; total: number }> {
  const offset = (pageNum - 1) * ITEMS_PER_PAGE;
  const params: (string | number)[] = [
    query,
    ITEMS_PER_PAGE,
    offset,
  ];

  const sql = `
    WITH matches AS (
      SELECT
        r.id,
        r.rcfa_number,
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
      AND r.deleted_at IS NULL
    )
    SELECT
      m.*,
      COUNT(*) OVER() AS total_count,
      s.owner_display_name,
      s.final_root_cause_count,
      s.action_item_count,
      s.open_action_item_count
    FROM matches m
    JOIN rcfa_summary s ON s.id = m.id
    ORDER BY m.rank DESC, m.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const results = await prisma.$queryRawUnsafe<SearchResultRow[]>(
    sql,
    ...params,
  );

  const total = results.length > 0 ? Number(results[0].total_count) : 0;

  const rows: RcfaRow[] = results.map((r) => ({
    id: r.id,
    rcfaNumber: r.rcfa_number,
    title: r.title || "Untitled RCFA",
    equipmentDescription: r.equipment_description,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString().slice(0, 10),
    ownerDisplayName: r.owner_display_name,
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
  const { page, q } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const searchQuery = q?.trim() ?? "";

  let rows: RcfaRow[];
  let totalPages: number;
  let searchTotal = 0;

  if (searchQuery) {
    const result = await searchRcfas(searchQuery, pageNum);
    rows = result.rows;
    searchTotal = result.total;
    totalPages = Math.max(1, Math.ceil(result.total / ITEMS_PER_PAGE));
  } else {
    const browseParams: (string | number)[] = [
      ITEMS_PER_PAGE,
      (pageNum - 1) * ITEMS_PER_PAGE,
    ];

    const browseSql = `
      SELECT
        s.id,
        s.rcfa_number,
        s.title,
        s.equipment_description,
        s.status,
        s.created_at,
        s.owner_display_name,
        s.final_root_cause_count,
        s.action_item_count,
        s.open_action_item_count,
        COUNT(*) OVER() AS total_count
      FROM rcfa_summary s
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
      rcfaNumber: r.rcfa_number,
      title: r.title || "Untitled RCFA",
      equipmentDescription: r.equipment_description,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString().slice(0, 10),
      ownerDisplayName: r.owner_display_name,
      rootCauseCount: Number(r.final_root_cause_count),
      actionItemCount: Number(r.action_item_count),
      openActionCount: Number(r.open_action_item_count),
    }));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight">
          <span className="text-zinc-900 dark:text-zinc-50">RCFAs</span>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">/</span>
          <Link
            href="/dashboard/action-items"
            className="text-sm font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Action Items
          </Link>
        </h1>
        <Link
          href="/dashboard/intake"
          className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New RCFA
        </Link>
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
        statusLabels={RCFA_STATUS_LABELS}
        statusColors={RCFA_STATUS_COLORS}
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
