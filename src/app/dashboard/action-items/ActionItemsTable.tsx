"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExportButtons from "@/components/ExportButtons";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import Link from "next/link";
import {
  DataTable,
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

/**
 * Parse URL search params into initial ColumnFiltersState.
 */
function parseFiltersFromUrl(sp: URLSearchParams): ColumnFiltersState {
  const filters: ColumnFiltersState = [];

  const id = sp.get("id");
  if (id) filters.push({ id: "actionItemNumber", value: id });

  const title = sp.get("title");
  if (title) filters.push({ id: "actionText", value: title });

  const status = sp.get("status");
  if (status) filters.push({ id: "status", value: status.split(",") });

  const priority = sp.get("priority");
  if (priority) filters.push({ id: "priority", value: priority.split(",") });

  const owner = sp.get("owner");
  if (owner) filters.push({ id: "ownerDisplayName", value: owner.split(",") });

  // Due date: combine dueDateFrom/dueDateTo into serialized value
  const dueDateFrom = sp.get("dueDateFrom");
  const dueDateTo = sp.get("dueDateTo");
  if (dueDateFrom && dueDateTo) {
    filters.push({ id: "dueDate", value: `range:${dueDateFrom},${dueDateTo}` });
  } else if (dueDateFrom) {
    filters.push({ id: "dueDate", value: `after:${dueDateFrom}` });
  } else if (dueDateTo) {
    filters.push({ id: "dueDate", value: `before:${dueDateTo}` });
  }

  const rcfa = sp.get("rcfa");
  if (rcfa) filters.push({ id: "rcfaNumber", value: rcfa });

  // Created date: combine createdFrom/createdTo
  const createdFrom = sp.get("createdFrom");
  const createdTo = sp.get("createdTo");
  if (createdFrom && createdTo) {
    filters.push({ id: "createdAt", value: `range:${createdFrom},${createdTo}` });
  } else if (createdFrom) {
    filters.push({ id: "createdAt", value: `after:${createdFrom}` });
  } else if (createdTo) {
    filters.push({ id: "createdAt", value: `before:${createdTo}` });
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

    // Backward compat: pass legacy filter=mine to API (dashboard "View all" link)
    if (legacyFilterRef.current === "mine") {
      params.set("filter", "mine");
    }

    return `/api/action-items?${params.toString()}`;
  }, [pagination, sorting, columnFilters]);

  // Fetch data when filters/pagination change
  useEffect(() => {
    const controller = new AbortController();

    // Setting loading before async operation is intentional to show loading state immediately
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    fetch(buildApiUrl(), { signal: controller.signal })
      .then((res) => res.json())
      .then((response: ApiResponse) => {
        setData(response.rows);
        setTotalRows(response.total);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch action items:", err);
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

  // Reset pagination to page 1 when filters change
  const handleFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      setColumnFilters(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setColumnFilters]
  );

  // Column definitions
  const columns = useMemo(
    () => [
      columnHelper.accessor("actionItemNumber", {
        header: "ID",
        size: 90,
        meta: { filterType: "text" as const, filterPlaceholder: "Search ID..." },
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
        meta: { filterType: "text" as const, filterPlaceholder: "Search title..." },
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
          filterType: "multi-select" as const,
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
          filterType: "multi-select" as const,
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
          filterType: "multi-select" as const,
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
        meta: { filterType: "date-range" as const },
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
        meta: { filterType: "text" as const, filterPlaceholder: "Search RCFA..." },
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
        meta: { filterType: "date-range" as const },
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

  // Handle export
  const handleExport = useCallback(
    (format: "csv" | "xlsx") => {
      if (format === "csv") {
        exportToCSV(data, exportColumns, "action-items");
      } else {
        exportToExcel(data, exportColumns, "action-items");
      }
    },
    [data, exportColumns]
  );

  return (
    <div className="space-y-4">
      {/* Result count and export */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalRows} action item{totalRows !== 1 ? "s" : ""} found
        </span>
        <ExportButtons
          onExport={handleExport}
          disabled={data.length === 0 || isLoading}
          rowCount={data.length}
        />
      </div>

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
