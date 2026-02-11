"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExportButtons from "@/components/ExportButtons";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import Link from "next/link";
import {
  DataTable,
  createColumnHelper,
  type SortingState,
  type PaginationState,
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

type StatusTabInfo = {
  key: "all" | "open" | "mine";
  label: string;
  getCount: (counts: StatusCounts) => number;
};

type StatusCounts = {
  all: number;
  open: number;
  mine: number;
};

const STATUS_TABS: StatusTabInfo[] = [
  { key: "all", label: "All", getCount: (c) => c.all },
  { key: "open", label: "Open", getCount: (c) => c.open },
  { key: "mine", label: "My Items", getCount: (c) => c.mine },
];

export default function ActionItemsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const users = useUsers();

  // Parse initial state from URL
  const urlPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const urlStatus = searchParams.get("status") ?? "";
  const urlPriority = searchParams.get("priority") ?? "";
  const urlOwner = searchParams.get("owner") ?? "";
  const urlSortBy = searchParams.get("sortBy") ?? "due_date";
  const urlSortOrder = searchParams.get("sortOrder") ?? "asc";
  const urlFilter = searchParams.get("filter") ?? "";
  const urlTab = searchParams.get("tab") ?? "open";

  // State
  const [data, setData] = useState<ActionItemTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ActionItemStatus>>(
    urlStatus ? new Set(urlStatus.split(",") as ActionItemStatus[]) : new Set()
  );
  const [selectedPriorities, setSelectedPriorities] = useState<Set<Priority>>(
    urlPriority ? new Set(urlPriority.split(",") as Priority[]) : new Set()
  );
  const [selectedOwner, setSelectedOwner] = useState(urlFilter === "mine" ? "" : urlOwner);
  const [isMineFilter, setIsMineFilter] = useState(urlFilter === "mine" || urlTab === "mine");
  const [activeTab, setActiveTab] = useState<"all" | "open" | "mine">(
    urlTab === "mine" ? "mine" : urlTab === "all" ? "all" : "open"
  );
  const [sorting, setSorting] = useState<SortingState>([
    { id: urlSortBy === "due_date" ? "dueDate" : urlSortBy, desc: urlSortOrder === "desc" },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: urlPage - 1,
    pageSize: 25,
  });
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    open: 0,
    mine: 0,
  });

  // Ref for URL update debounce timer
  const urlUpdateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Build API URL from current state
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(pagination.pageIndex + 1));
    params.set("pageSize", String(pagination.pageSize));

    if (sorting.length > 0) {
      const sortCol = sorting[0].id === "dueDate" ? "due_date" :
        sorting[0].id === "createdAt" ? "created_at" :
        sorting[0].id === "ownerDisplayName" ? "owner_display_name" :
        sorting[0].id === "actionItemNumber" ? "action_item_number" :
        sorting[0].id === "actionText" ? "action_text" :
        sorting[0].id === "rcfaNumber" ? "rcfa_number" :
        sorting[0].id;
      params.set("sortBy", sortCol);
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    if (isMineFilter) {
      params.set("filter", "mine");
    }

    // Apply tab-based status filter for "open" tab
    if (activeTab === "open" && selectedStatuses.size === 0) {
      params.set("status", "open,in_progress,blocked");
    } else if (selectedStatuses.size > 0) {
      params.set("status", Array.from(selectedStatuses).join(","));
    }

    if (selectedPriorities.size > 0) {
      params.set("priority", Array.from(selectedPriorities).join(","));
    }

    if (selectedOwner && !isMineFilter) {
      params.set("owner", selectedOwner);
    }

    return `/api/action-items?${params.toString()}`;
  }, [pagination, sorting, selectedStatuses, selectedPriorities, selectedOwner, isMineFilter, activeTab]);

  // Fetch counts for tabs (refreshes when data changes)
  useEffect(() => {
    const controller = new AbortController();

    const fetchCounts = async () => {
      try {
        const [allRes, openRes, mineRes] = await Promise.all([
          fetch("/api/action-items?pageSize=1", { signal: controller.signal }),
          fetch("/api/action-items?pageSize=1&status=open,in_progress,blocked", { signal: controller.signal }),
          fetch("/api/action-items?pageSize=1&filter=mine", { signal: controller.signal }),
        ]);

        // Check if aborted before parsing JSON
        if (controller.signal.aborted) return;

        const [allData, openData, mineData] = await Promise.all([
          allRes.json(),
          openRes.json(),
          mineRes.json(),
        ]);

        // Check again before setting state
        if (controller.signal.aborted) return;

        setStatusCounts({
          all: allData.total ?? 0,
          open: openData.total ?? 0,
          mine: mineData.total ?? 0,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch counts:", err);
        }
      }
    };

    fetchCounts();

    return () => controller.abort();
  }, [data]); // Refresh counts when main data changes

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
    // Clear any pending URL update
    if (urlUpdateTimerRef.current) {
      clearTimeout(urlUpdateTimerRef.current);
    }

    // Debounce URL updates by 150ms
    urlUpdateTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (pagination.pageIndex > 0) params.set("page", String(pagination.pageIndex + 1));
      if (selectedStatuses.size > 0) params.set("status", Array.from(selectedStatuses).join(","));
      if (selectedPriorities.size > 0) params.set("priority", Array.from(selectedPriorities).join(","));
      if (selectedOwner && !isMineFilter) params.set("owner", selectedOwner);
      if (activeTab !== "open") params.set("tab", activeTab);
      if (sorting.length > 0) {
        const sortCol = sorting[0].id === "dueDate" ? "due_date" : sorting[0].id;
        if (sortCol !== "due_date") params.set("sortBy", sortCol);
        if (sorting[0].desc) params.set("sortOrder", "desc");
      }

      const newUrl = `/dashboard/action-items${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    }, 150);

    return () => {
      if (urlUpdateTimerRef.current) {
        clearTimeout(urlUpdateTimerRef.current);
      }
    };
  }, [pagination.pageIndex, selectedStatuses, selectedPriorities, selectedOwner, isMineFilter, activeTab, sorting, router]);

  // Toggle status filter
  const toggleStatus = (status: ActionItemStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Toggle priority filter
  const togglePriority = (priority: Priority) => {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) {
        next.delete(priority);
      } else {
        next.add(priority);
      }
      return next;
    });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Handle tab change
  const handleTabChange = (tab: "all" | "open" | "mine") => {
    setActiveTab(tab);
    setIsMineFilter(tab === "mine");
    // Clear status filter when switching tabs to avoid confusion
    setSelectedStatuses(new Set());
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Column definitions
  const columns = useMemo(
    () => [
      columnHelper.accessor("actionItemNumber", {
        header: "ID",
        size: 90,
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
        cell: (info) => (
          <div className="max-w-[250px] truncate" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 110,
        enableColumnFilter: false,
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
        enableColumnFilter: false,
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
        enableColumnFilter: false,
        cell: (info) => info.getValue() ?? "Unassigned",
      }),
      columnHelper.accessor("dueDate", {
        header: "Due Date",
        size: 130,
        cell: (info) => {
          const dueDate = info.getValue();
          const status = info.row.original.status;
          // Don't show urgency styling for completed/canceled items
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
      }),
    ],
    []
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
      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label} ({tab.getCount(statusCounts)})
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 text-xs text-zinc-500 dark:text-zinc-400">Status:</span>
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedStatuses.has(status)
                  ? ACTION_STATUS_COLORS[status]
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {ACTION_STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        {/* Priority filter buttons */}
        <div className="flex flex-wrap gap-1.5">
          <span className="mr-1 text-xs text-zinc-500 dark:text-zinc-400">Priority:</span>
          {ALL_PRIORITIES.map((priority) => (
            <button
              key={priority}
              onClick={() => togglePriority(priority)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedPriorities.has(priority)
                  ? PRIORITY_COLORS[priority]
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {PRIORITY_LABELS[priority]}
            </button>
          ))}
        </div>

        {/* Owner filter dropdown */}
        {!isMineFilter && (
          <select
            value={selectedOwner}
            onChange={(e) => {
              setSelectedOwner(e.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">All Owners</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        )}

        {/* Result count and export */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {totalRows} action item{totalRows !== 1 ? "s" : ""} found
          </span>
          <ExportButtons
            onExport={handleExport}
            disabled={data.length === 0 || isLoading}
            rowCount={data.length}
          />
        </div>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage={
          selectedStatuses.size > 0 || selectedPriorities.size > 0 || selectedOwner || isMineFilter
            ? "No action items match the selected filters."
            : "No action items yet. Create an RCFA to get started."
        }
        showPagination={true}
        enableFilters={false}
        pageSize={pagination.pageSize}
        pageSizeOptions={[10, 25, 50]}
        totalRows={totalRows}
        pageIndex={pagination.pageIndex}
        manualPagination={true}
        manualSorting={true}
        manualFiltering={true}
        onPaginationChange={setPagination}
        onSortingChange={setSorting}
      />
    </div>
  );
}
