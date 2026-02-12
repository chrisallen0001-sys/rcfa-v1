"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExportButtons from "@/components/ExportButtons";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
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
import type { ActionItemStatus, Priority } from "@/generated/prisma/client";
import {
  formatActionItemNumber,
  formatRcfaNumber,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDueDateWithColor,
} from "@/lib/rcfa-utils";
import { useUsers } from "@/hooks/useUsers";

export type ActionItemTableRow = {
  id: string;
  actionItemNumber: number;
  actionText: string;
  actionDescription: string | null;
  priority: Priority;
  status: ActionItemStatus;
  dueDate: string | null;
  createdAt: string;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  rcfaId: string;
  rcfaNumber: number;
  rcfaTitle: string;
};

type ApiResponse = {
  rows: ActionItemTableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ALL_STATUSES: ActionItemStatus[] = ["open", "in_progress", "blocked", "done", "canceled"];
const ALL_PRIORITIES: Priority[] = ["high", "medium", "low", "deprioritized"];

const columnHelper = createColumnHelper<ActionItemTableRow>();

/** Map a column ID to the API sort column name. */
function toApiSortColumn(id: string): string {
  const map: Record<string, string> = {
    dueDate: "due_date",
    createdAt: "created_at",
    ownerDisplayName: "owner_display_name",
    actionItemNumber: "action_item_number",
    actionText: "action_text",
    rcfaNumber: "rcfa_number",
  };
  return map[id] ?? id;
}

/** Reverse: API sort column → column ID. */
function fromApiSortColumn(col: string): string {
  const map: Record<string, string> = {
    due_date: "dueDate",
    created_at: "createdAt",
    owner_display_name: "ownerDisplayName",
    action_item_number: "actionItemNumber",
    action_text: "actionText",
    rcfa_number: "rcfaNumber",
  };
  return map[col] ?? col;
}

/** Validate an ISO date string (yyyy-MM-dd) syntactically and semantically.
 *  Round-trips through toISOString() to reject overflow dates (e.g. Feb 30 → Mar 2). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Default status filter: show only actionable items (matches old "Open" tab). */
const DEFAULT_STATUSES: ActionItemStatus[] = ["open", "in_progress", "blocked"];

/**
 * Parse URL search params into initial ColumnFiltersState.
 * Malformed date values are silently dropped to prevent 400 errors from the API.
 */
function parseFiltersFromUrl(sp: URLSearchParams): ColumnFiltersState {
  const filters: ColumnFiltersState = [];

  const id = sp.get("id");
  if (id) filters.push({ id: "actionItemNumber", value: id });

  const title = sp.get("title");
  if (title) filters.push({ id: "actionText", value: title });

  const status = sp.get("status");
  if (status) {
    filters.push({ id: "status", value: status.split(",") });
  } else if (sp.get("filter") !== "mine") {
    // Default to open/actionable statuses unless the legacy ?filter=mine is active
    // (which lets the API control the full result set). Matches old "Open" tab default.
    filters.push({ id: "status", value: [...DEFAULT_STATUSES] });
  }

  const priority = sp.get("priority");
  if (priority) filters.push({ id: "priority", value: priority.split(",") });

  const owner = sp.get("owner");
  if (owner) filters.push({ id: "ownerDisplayName", value: owner.split(",") });

  // Due date: combine dueDateFrom/dueDateTo into serialized value (skip malformed dates)
  const dueDateFrom = sp.get("dueDateFrom");
  const dueDateTo = sp.get("dueDateTo");
  const validDueDateFrom = dueDateFrom && isValidDate(dueDateFrom) ? dueDateFrom : null;
  const validDueDateTo = dueDateTo && isValidDate(dueDateTo) ? dueDateTo : null;
  if (validDueDateFrom && validDueDateTo) {
    filters.push({ id: "dueDate", value: `range:${validDueDateFrom},${validDueDateTo}` });
  } else if (validDueDateFrom) {
    filters.push({ id: "dueDate", value: `after:${validDueDateFrom}` });
  } else if (validDueDateTo) {
    filters.push({ id: "dueDate", value: `before:${validDueDateTo}` });
  }

  const rcfa = sp.get("rcfa");
  if (rcfa) filters.push({ id: "rcfaNumber", value: rcfa });

  // Created date: combine createdFrom/createdTo (skip malformed dates)
  const createdFrom = sp.get("createdFrom");
  const createdTo = sp.get("createdTo");
  const validCreatedFrom = createdFrom && isValidDate(createdFrom) ? createdFrom : null;
  const validCreatedTo = createdTo && isValidDate(createdTo) ? createdTo : null;
  if (validCreatedFrom && validCreatedTo) {
    filters.push({ id: "createdAt", value: `range:${validCreatedFrom},${validCreatedTo}` });
  } else if (validCreatedFrom) {
    filters.push({ id: "createdAt", value: `after:${validCreatedFrom}` });
  } else if (validCreatedTo) {
    filters.push({ id: "createdAt", value: `before:${validCreatedTo}` });
  }

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
      case "actionItemNumber":
        params.set("actionItemNumber", val as string);
        break;
      case "actionText":
        params.set("actionText", val as string);
        break;
      case "status":
        params.set("status", (val as string[]).join(","));
        break;
      case "priority":
        params.set("priority", (val as string[]).join(","));
        break;
      case "ownerDisplayName":
        params.set("owner", (val as string[]).join(","));
        break;
      case "dueDate": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if (mode === "after" && from) params.set("dueDateFrom", from);
        if (mode === "before" && to) params.set("dueDateTo", to);
        if (mode === "range") {
          if (from) params.set("dueDateFrom", from);
          if (to) params.set("dueDateTo", to);
        }
        break;
      }
      case "rcfaNumber":
        params.set("rcfaNumber", val as string);
        break;
      case "createdAt": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if (mode === "after" && from) params.set("createdFrom", from);
        if (mode === "before" && to) params.set("createdTo", to);
        if (mode === "range") {
          if (from) params.set("createdFrom", from);
          if (to) params.set("createdTo", to);
        }
        break;
      }
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
      case "actionItemNumber":
        params.set("id", val as string);
        break;
      case "actionText":
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
      case "priority":
        params.set("priority", (val as string[]).join(","));
        break;
      case "ownerDisplayName":
        params.set("owner", (val as string[]).join(","));
        break;
      case "dueDate": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if ((mode === "after" || mode === "range") && from) params.set("dueDateFrom", from);
        if ((mode === "before" || mode === "range") && to) params.set("dueDateTo", to);
        break;
      }
      case "rcfaNumber":
        params.set("rcfa", val as string);
        break;
      case "createdAt": {
        const { mode, from, to } = parseDateRangeValue(val as string);
        if ((mode === "after" || mode === "range") && from) params.set("createdFrom", from);
        if ((mode === "before" || mode === "range") && to) params.set("createdTo", to);
        break;
      }
    }
  }
}

export default function ActionItemsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const users = useUsers();

  // Parse initial state from URL
  const urlPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const urlSortBy = searchParams.get("sortBy") ?? "due_date";
  const urlSortOrder = searchParams.get("sortOrder") ?? "asc";

  // Backward compat: dashboard links to ?filter=mine — pass through to API
  const legacyFilterRef = useRef(searchParams.get("filter"));

  // State
  const [data, setData] = useState<ActionItemTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
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

  // Build the common URLSearchParams shared by data fetch and export.
  // Includes sorting, column filters, and the legacy ?filter=mine param.
  const buildBaseApiParams = useCallback(() => {
    const params = new URLSearchParams();

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

    return params;
  }, [sorting, columnFilters]);

  // Build API URL from current state
  const buildApiUrl = useCallback(() => {
    const params = buildBaseApiParams();
    params.set("page", String(pagination.pageIndex + 1));
    params.set("pageSize", String(pagination.pageSize));
    return `/api/action-items?${params.toString()}`;
  }, [pagination, buildBaseApiParams]);

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
          // Inject default status filter so closed items don't appear on subsequent interactions
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
          console.error("Failed to fetch action items:", err);
          setFetchError(err instanceof Error ? err.message : "Failed to load action items.");
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
        if (sortCol !== "due_date") params.set("sortBy", sortCol);
        if (sorting[0].desc) params.set("sortOrder", "desc");
      }
      filtersToUrlParams(params, columnFilters);

      const newUrl = `/dashboard/action-items${params.toString() ? `?${params.toString()}` : ""}`;
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
      columnHelper.accessor("actionItemNumber", {
        header: "ID",
        size: 90,
        meta: { filterType: "text", filterPlaceholder: "Search ID..." },
        cell: (info) => (
          <Link
            href={`/dashboard/rcfa/${info.row.original.rcfaId}?expandItem=${info.row.original.id}`}
            className="font-mono text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {formatActionItemNumber(info.getValue())}
          </Link>
        ),
      }),
      columnHelper.accessor("actionText", {
        header: "Title",
        size: 250,
        meta: { filterType: "text", filterPlaceholder: "Search title..." },
        cell: (info) => (
          <div className="max-w-[250px] truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 110,
        meta: {
          filterType: "multi-select",
          filterOptions: ALL_STATUSES.map((s) => ({
            label: ACTION_STATUS_LABELS[s],
            value: s,
          })),
          filterColorMap: ACTION_STATUS_COLORS,
        },
        cell: (info) => {
          const status = info.getValue();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_STATUS_COLORS[status]}`}
            >
              {ACTION_STATUS_LABELS[status]}
            </span>
          );
        },
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        size: 100,
        meta: {
          filterType: "multi-select",
          filterOptions: ALL_PRIORITIES.map((p) => ({
            label: PRIORITY_LABELS[p],
            value: p,
          })),
          filterColorMap: PRIORITY_COLORS,
        },
        cell: (info) => {
          const priority = info.getValue();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority]}`}
            >
              {PRIORITY_LABELS[priority]}
            </span>
          );
        },
      }),
      columnHelper.accessor("ownerDisplayName", {
        header: "Owner",
        size: 120,
        meta: {
          filterType: "multi-select",
          // Options populate once useUsers() resolves; until then the filter button
          // briefly shows "N selected" instead of names. Self-corrects when users load
          // because this memo depends on [users].
          filterOptions: users.map((u) => ({
            label: u.displayName,
            value: u.id,
          })),
        },
        cell: (info) => info.getValue() ?? "Unassigned",
      }),
      columnHelper.accessor("dueDate", {
        header: "Due Date",
        size: 130,
        meta: { filterType: "date-range" },
        cell: (info) => {
          const dueDate = info.getValue();
          const status = info.row.original.status;
          if (status === "done" || status === "canceled") {
            return dueDate ?? "No due date";
          }
          const dateInfo = formatDueDateWithColor(dueDate ? new Date(dueDate) : null);
          return <span className={dateInfo.colorClass}>{dateInfo.text}</span>;
        },
      }),
      columnHelper.accessor("rcfaNumber", {
        header: "RCFA",
        size: 100,
        meta: { filterType: "text", filterPlaceholder: "Search RCFA..." },
        cell: (info) => (
          <Link
            href={`/dashboard/rcfa/${info.row.original.rcfaId}`}
            className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {formatRcfaNumber(info.getValue())}
          </Link>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        size: 100,
        meta: { filterType: "date-range" },
      }),
    ],
    [users]
  );

  // Export column definitions
  const exportColumns: ExportColumn<ActionItemTableRow>[] = useMemo(
    () => [
      { header: "ID", accessor: (row) => formatActionItemNumber(row.actionItemNumber) },
      { header: "Title", accessor: "actionText" },
      { header: "Description", accessor: "actionDescription" },
      { header: "Status", accessor: (row) => ACTION_STATUS_LABELS[row.status] },
      { header: "Priority", accessor: (row) => PRIORITY_LABELS[row.priority] },
      { header: "Owner", accessor: (row) => row.ownerDisplayName ?? "Unassigned" },
      { header: "Due Date", accessor: "dueDate" },
      { header: "Created", accessor: "createdAt" },
      { header: "RCFA #", accessor: (row) => formatRcfaNumber(row.rcfaNumber) },
      { header: "RCFA Title", accessor: "rcfaTitle" },
    ],
    []
  );

  // Build API URL for export (all filtered rows, no pagination limit)
  const buildExportApiUrl = useCallback(() => {
    const params = buildBaseApiParams();
    params.set("pageSize", "0");
    return `/api/action-items?${params.toString()}`;
  }, [buildBaseApiParams]);

  // Handle export — fetches all filtered rows (not just current page) then exports
  const handleExport = useCallback(
    async (format: "csv" | "xlsx") => {
      try {
        setExportError(null);
        const res = await fetch(buildExportApiUrl());
        if (!res.ok) {
          let message = `Export failed: HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body.error) message = `Export failed: ${body.error}`;
          } catch {
            // non-JSON response
          }
          setExportError(message);
          return;
        }
        const { rows } = (await res.json()) as ApiResponse;
        if (format === "csv") {
          exportToCSV(rows, exportColumns, "action-items");
        } else {
          exportToExcel(rows, exportColumns, "action-items");
        }
      } catch (err) {
        setExportError(
          err instanceof Error ? `Export failed: ${err.message}` : "Export failed due to a network error."
        );
      }
    },
    // setExportError is a stable state setter; listed here for React Compiler lint compliance.
    [buildExportApiUrl, exportColumns, setExportError]
  );

  return (
    <div className="space-y-4">
      {/* Error banners */}
      {fetchError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {fetchError}
        </div>
      )}
      {exportError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {exportError}
        </div>
      )}

      {/* Result count and export */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalRows} action item{totalRows !== 1 ? "s" : ""} found
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
            ? "No action items match the selected filters."
            : "No action items yet. Create an RCFA to get started."
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
