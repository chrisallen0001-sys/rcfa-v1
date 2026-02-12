"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DataTable,
  ActiveFilterChips,
  createColumnHelper,
  parseDateRangeValue,
  type SortingState,
  type PaginationState,
  type ColumnFiltersState,
} from "@/components/DataTable";
import type { RcfaStatus, OperatingContext } from "@/generated/prisma/client";
import {
  formatRcfaNumber,
  RCFA_STATUS_LABELS,
  RCFA_STATUS_COLORS,
} from "@/lib/rcfa-utils";
import { useUsers } from "@/hooks/useUsers";
import ExportButtons from "@/components/ExportButtons";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";

export type RcfaTableRow = {
  id: string;
  rcfaNumber: number;
  title: string;
  equipmentDescription: string;
  status: RcfaStatus;
  operatingContext: OperatingContext;
  createdAt: string;
  ownerUserId: string;
  ownerDisplayName: string;
  rootCauseCount: number;
  actionItemCount: number;
  openActionCount: number;
};

type ApiResponse = {
  rows: RcfaTableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ALL_STATUSES: RcfaStatus[] = ["draft", "investigation", "actions_open", "closed"];

const columnHelper = createColumnHelper<RcfaTableRow>();

/** Map a column ID to the API sort column name. */
function toApiSortColumn(id: string): string {
  const map: Record<string, string> = {
    createdAt: "created_at",
    ownerDisplayName: "owner_display_name",
    rcfaNumber: "rcfa_number",
    rootCauseCount: "final_root_cause_count",
    actionItemCount: "action_item_count",
    equipmentDescription: "equipment_description",
  };
  return map[id] ?? id;
}

/** Reverse: API sort column -> column ID. */
function fromApiSortColumn(col: string): string {
  const map: Record<string, string> = {
    created_at: "createdAt",
    owner_display_name: "ownerDisplayName",
    rcfa_number: "rcfaNumber",
    final_root_cause_count: "rootCauseCount",
    action_item_count: "actionItemCount",
    equipment_description: "equipmentDescription",
  };
  return map[col] ?? col;
}

/** Validate an ISO date string (yyyy-MM-dd) syntactically and semantically.
 *  Round-trips through toISOString() to reject overflow dates (e.g. Feb 30 -> Mar 2). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Default status filter: show active (non-closed) RCFAs. */
const DEFAULT_STATUSES: RcfaStatus[] = ["draft", "investigation", "actions_open"];

/**
 * Parse URL search params into initial ColumnFiltersState.
 * Malformed date values are silently dropped to prevent 400 errors from the API.
 */
function parseFiltersFromUrl(sp: URLSearchParams): ColumnFiltersState {
  const filters: ColumnFiltersState = [];

  const rcfaNum = sp.get("rcfaNum");
  if (rcfaNum) filters.push({ id: "rcfaNumber", value: rcfaNum });

  const title = sp.get("title");
  if (title) filters.push({ id: "title", value: title });

  const status = sp.get("status");
  if (status) {
    filters.push({ id: "status", value: status.split(",") });
  } else if (sp.get("filter") !== "mine") {
    // Default to active statuses unless the legacy ?filter=mine is active
    // (which lets the API control the full result set). Matches old behavior.
    filters.push({ id: "status", value: [...DEFAULT_STATUSES] });
  }

  const owner = sp.get("owner");
  if (owner) filters.push({ id: "ownerDisplayName", value: owner.split(",") });

  // Created date: combine dateFrom/dateTo (skip malformed dates)
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const validDateFrom = dateFrom && isValidDate(dateFrom) ? dateFrom : null;
  const validDateTo = dateTo && isValidDate(dateTo) ? dateTo : null;
  if (validDateFrom && validDateTo) {
    filters.push({ id: "createdAt", value: `range:${validDateFrom},${validDateTo}` });
  } else if (validDateFrom) {
    filters.push({ id: "createdAt", value: `after:${validDateFrom}` });
  } else if (validDateTo) {
    filters.push({ id: "createdAt", value: `before:${validDateTo}` });
  }

  const equipment = sp.get("equipment");
  if (equipment) filters.push({ id: "equipmentDescription", value: equipment });

  return filters;
}

/**
 * Map columnFilters to API query params on the URL.
 */
function applyFiltersToApiParams(
  params: URLSearchParams,
  columnFilters: ColumnFiltersState
) {
  for (const filter of columnFilters) {
    const val = filter.value;
    switch (filter.id) {
      case "rcfaNumber":
        params.set("rcfaNumber", val as string);
        break;
      case "title":
        params.set("title", val as string);
        break;
      case "status":
        params.set("status", (val as string[]).join(","));
        break;
      case "ownerDisplayName":
        params.set("owner", (val as string[]).join(","));
        break;
      case "createdAt": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if (mode === "after" && from) params.set("dateFrom", from);
        if (mode === "before" && to) params.set("dateTo", to);
        if (mode === "range") {
          if (from) params.set("dateFrom", from);
          if (to) params.set("dateTo", to);
        }
        break;
      }
      case "equipmentDescription":
        params.set("equipment", val as string);
        break;
    }
  }
}

/**
 * Serialize columnFilters to URL search params for the browser URL bar.
 */
function filtersToUrlParams(
  params: URLSearchParams,
  columnFilters: ColumnFiltersState
) {
  for (const filter of columnFilters) {
    const val = filter.value;
    switch (filter.id) {
      case "rcfaNumber":
        params.set("rcfaNum", val as string);
        break;
      case "title":
        params.set("title", val as string);
        break;
      case "status": {
        // Skip serializing the default status filter to keep the URL clean
        const sorted = [...(val as string[])].sort().join(",");
        const defaultSorted = [...DEFAULT_STATUSES].sort().join(",");
        if (sorted !== defaultSorted) {
          params.set("status", (val as string[]).join(","));
        }
        break;
      }
      case "ownerDisplayName":
        params.set("owner", (val as string[]).join(","));
        break;
      case "createdAt": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if ((mode === "after" || mode === "range") && from) params.set("dateFrom", from);
        if ((mode === "before" || mode === "range") && to) params.set("dateTo", to);
        break;
      }
      case "equipmentDescription":
        params.set("equipment", val as string);
        break;
    }
  }
}

export default function RcfaTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const users = useUsers();

  // Parse initial state from URL
  const urlPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const urlSortBy = searchParams.get("sortBy") ?? "created_at";
  const urlSortOrder = searchParams.get("sortOrder") ?? "desc";

  // Backward compat: dashboard links to ?filter=mine — pass through to API
  const legacyFilterRef = useRef(searchParams.get("filter"));

  // State
  const [data, setData] = useState<RcfaTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    () => parseFiltersFromUrl(searchParams)
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: fromApiSortColumn(urlSortBy), desc: urlSortOrder === "desc" },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: urlPage - 1,
    pageSize: 25,
  });

  // Ref for URL update debounce timer
  const urlUpdateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Build API URL from current state
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(pagination.pageIndex + 1));
    params.set("pageSize", String(pagination.pageSize));

    if (sorting.length > 0) {
      params.set("sortBy", toApiSortColumn(sorting[0].id));
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    applyFiltersToApiParams(params, columnFilters);

    // Read from ref (not a dependency) so the legacy ?filter=mine param is included
    // on the first fetch but automatically drops out once cleared in .then() or
    // handleFiltersChange, without triggering a re-fetch cycle.
    if (legacyFilterRef.current === "mine") {
      params.set("filter", "mine");
    }

    return `/api/rcfa?${params.toString()}`;
  }, [pagination, sorting, columnFilters]);

  // Fetch data when filters/pagination change
  useEffect(() => {
    const controller = new AbortController();

    // Setting loading before async operation is intentional to show loading state immediately
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setFetchError(null);
    fetch(buildApiUrl(), { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body.error) message = body.error;
          } catch {
            // Response body is not JSON (e.g., gateway HTML error page)
          }
          throw new Error(message);
        }
        return res.json();
      })
      .then((response: ApiResponse) => {
        setData(response.rows);
        setTotalRows(response.total);
        // Clear legacy filter after initial load so subsequent interactions
        // aren't permanently scoped to "mine" (see backward-compat note above).
        if (legacyFilterRef.current === "mine") {
          legacyFilterRef.current = null;
          // Inject default status filter so closed RCFAs don't appear on subsequent interactions
          setColumnFilters((prev) => {
            const hasStatus = prev.some((f) => f.id === "status");
            if (!hasStatus) {
              return [...prev, { id: "status", value: [...DEFAULT_STATUSES] }];
            }
            return prev;
          });
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch RCFAs:", err);
          setFetchError(err instanceof Error ? err.message : "Failed to load RCFAs.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [buildApiUrl]);

  // Update URL when filters change (debounced to prevent history spam)
  useEffect(() => {
    if (urlUpdateTimerRef.current) {
      clearTimeout(urlUpdateTimerRef.current);
    }

    urlUpdateTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (pagination.pageIndex > 0) params.set("page", String(pagination.pageIndex + 1));
      if (sorting.length > 0) {
        const sortCol = toApiSortColumn(sorting[0].id);
        if (sortCol !== "created_at") params.set("sortBy", sortCol);
        if (!sorting[0].desc) params.set("sortOrder", "asc");
      }
      filtersToUrlParams(params, columnFilters);

      const newUrl = `/dashboard/rcfas${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    }, 150);

    return () => {
      if (urlUpdateTimerRef.current) {
        clearTimeout(urlUpdateTimerRef.current);
      }
    };
  }, [pagination.pageIndex, sorting, columnFilters, router]);

  // Reset pagination to page 1 when filters change.
  // Also clears legacy filter=mine so explicit user interaction takes precedence.
  const handleFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      legacyFilterRef.current = null;
      setColumnFilters(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    // setColumnFilters is a stable state setter; listed here for React Compiler lint compliance.
    [setColumnFilters]
  );

  // Column definitions
  const columns = useMemo(
    () => [
      columnHelper.accessor("rcfaNumber", {
        header: "RCFA #",
        size: 100,
        meta: { filterType: "text", filterPlaceholder: "Search #..." },
        cell: (info) => (
          <Link
            href={`/dashboard/rcfa/${info.row.original.id}`}
            className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {formatRcfaNumber(info.getValue())}
          </Link>
        ),
      }),
      columnHelper.accessor("title", {
        header: "Title",
        size: 250,
        meta: { filterType: "text", filterPlaceholder: "Search title..." },
        cell: (info) => (
          <div className="max-w-[250px] truncate" title={info.getValue()}>
            {info.getValue() || "Untitled RCFA"}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 120,
        meta: {
          filterType: "multi-select",
          filterOptions: ALL_STATUSES.map((s) => ({
            label: RCFA_STATUS_LABELS[s],
            value: s,
          })),
          filterColorMap: RCFA_STATUS_COLORS,
        },
        cell: (info) => {
          const status = info.getValue();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RCFA_STATUS_COLORS[status]}`}
            >
              {RCFA_STATUS_LABELS[status]}
            </span>
          );
        },
      }),
      columnHelper.accessor("ownerDisplayName", {
        header: "Owner",
        size: 150,
        meta: {
          filterType: "multi-select",
          filterOptions: users.map((u) => ({
            label: u.displayName,
            value: u.id,
          })),
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        size: 100,
        meta: { filterType: "date-range" },
      }),
      columnHelper.accessor("equipmentDescription", {
        header: "Equipment",
        size: 200,
        meta: { filterType: "text", filterPlaceholder: "Search equipment..." },
        cell: (info) => (
          <div className="max-w-[200px] truncate text-xs" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("rootCauseCount", {
        header: "Root Causes",
        size: 100,
        enableColumnFilter: false,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("actionItemCount", {
        header: "Actions",
        size: 80,
        enableColumnFilter: false,
        cell: (info) => {
          const count = info.getValue();
          const open = info.row.original.openActionCount;
          if (open > 0) {
            return (
              <span>
                {count}{" "}
                <span className="text-amber-600 dark:text-amber-400">({open} open)</span>
              </span>
            );
          }
          return count;
        },
      }),
    ],
    [users]
  );

  // Export column definitions
  const exportColumns: ExportColumn<RcfaTableRow>[] = useMemo(
    () => [
      { header: "RCFA #", accessor: (row) => formatRcfaNumber(row.rcfaNumber) },
      { header: "Title", accessor: "title" },
      { header: "Status", accessor: (row) => RCFA_STATUS_LABELS[row.status] },
      { header: "Owner", accessor: "ownerDisplayName" },
      { header: "Created", accessor: "createdAt" },
      { header: "Equipment", accessor: "equipmentDescription" },
      { header: "Operating Context", accessor: "operatingContext" },
      { header: "Root Causes", accessor: "rootCauseCount" },
      { header: "Action Items", accessor: "actionItemCount" },
      { header: "Open Actions", accessor: "openActionCount" },
    ],
    []
  );

  // Build API URL for export (all filtered rows, no pagination limit)
  const buildExportApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("pageSize", "0");

    if (sorting.length > 0) {
      params.set("sortBy", toApiSortColumn(sorting[0].id));
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    applyFiltersToApiParams(params, columnFilters);

    if (legacyFilterRef.current === "mine") {
      params.set("filter", "mine");
    }

    return `/api/rcfa?${params.toString()}`;
  }, [sorting, columnFilters]);

  // Handle export — fetches all filtered rows (not just current page) then exports
  const handleExport = useCallback(
    async (format: "csv" | "xlsx") => {
      const res = await fetch(buildExportApiUrl());
      if (!res.ok) {
        let message = `Export failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // non-JSON response
        }
        setFetchError(message);
        return;
      }
      const { rows } = (await res.json()) as ApiResponse;
      if (format === "csv") {
        exportToCSV(rows, exportColumns, "rcfas");
      } else {
        exportToExcel(rows, exportColumns, "rcfas");
      }
    },
    // setFetchError is a stable state setter; listed here for React Compiler lint compliance.
    [buildExportApiUrl, exportColumns, setFetchError]
  );

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {fetchError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {fetchError}
        </div>
      )}

      {/* Result count and export */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalRows} RCFA{totalRows !== 1 ? "s" : ""} found
        </span>
        <ExportButtons
          onExport={handleExport}
          disabled={totalRows === 0 || isLoading}
          rowCount={totalRows}
        />
      </div>

      {/* Active filter chips */}
      <ActiveFilterChips
        columnFilters={columnFilters}
        columns={columns}
        onRemoveFilter={(id) =>
          handleFiltersChange((prev) => prev.filter((f) => f.id !== id))
        }
        onClearAll={() => handleFiltersChange([{ id: "status", value: [...DEFAULT_STATUSES] }])}
        defaultStatuses={DEFAULT_STATUSES}
      />

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage={
          columnFilters.length > 0
            ? "No RCFAs match the selected filters."
            : "No RCFAs yet. Click 'New RCFA' to get started."
        }
        showPagination={true}
        enableFilters={true}
        columnFilters={columnFilters}
        pageSize={pagination.pageSize}
        pageSizeOptions={[10, 25, 50]}
        totalRows={totalRows}
        pageIndex={pagination.pageIndex}
        manualPagination={true}
        manualSorting={true}
        manualFiltering={true}
        onPaginationChange={setPagination}
        onSortingChange={setSorting}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
