"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DataTable,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from "@/components/DataTable";
import type { RcfaStatus, OperatingContext } from "@/generated/prisma/client";
import {
  formatRcfaNumber,
  RCFA_STATUS_LABELS,
  RCFA_STATUS_COLORS,
} from "@/lib/rcfa-utils";

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
  equipmentHighlight?: string;
  failureHighlight?: string;
};

type ApiResponse = {
  rows: RcfaTableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type User = {
  id: string;
  displayName: string;
};

const ALL_STATUSES: RcfaStatus[] = ["draft", "investigation", "actions_open", "closed"];

const columnHelper = createColumnHelper<RcfaTableRow>();

export default function RcfaTable({ initialFilter }: { initialFilter?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const urlPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const urlSearch = searchParams.get("q") ?? "";
  const urlStatus = searchParams.get("status") ?? "";
  const urlOwner = searchParams.get("owner") ?? "";
  const urlSortBy = searchParams.get("sortBy") ?? "created_at";
  const urlSortOrder = searchParams.get("sortOrder") ?? "desc";
  const urlFilter = searchParams.get("filter") ?? initialFilter ?? "";

  // State
  const [data, setData] = useState<RcfaTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState(urlSearch);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RcfaStatus>>(
    urlStatus ? new Set(urlStatus.split(",") as RcfaStatus[]) : new Set()
  );
  const [selectedOwner, setSelectedOwner] = useState(urlFilter === "mine" ? "" : urlOwner);
  const [isMineFilter, setIsMineFilter] = useState(urlFilter === "mine");
  const [sorting, setSorting] = useState<SortingState>([
    { id: urlSortBy === "created_at" ? "createdAt" : urlSortBy, desc: urlSortOrder === "desc" },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: urlPage - 1,
    pageSize: 25,
  });

  // Fetch users for owner filter dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data: User[]) => setUsers(data))
      .catch(console.error);
  }, []);

  // Build API URL from current state
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(pagination.pageIndex + 1));
    params.set("pageSize", String(pagination.pageSize));

    if (sorting.length > 0) {
      const sortCol = sorting[0].id === "createdAt" ? "created_at" :
        sorting[0].id === "ownerDisplayName" ? "owner_display_name" :
        sorting[0].id === "rcfaNumber" ? "rcfa_number" :
        sorting[0].id === "rootCauseCount" ? "final_root_cause_count" :
        sorting[0].id === "actionItemCount" ? "action_item_count" :
        sorting[0].id;
      params.set("sortBy", sortCol);
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    if (isMineFilter) {
      params.set("filter", "mine");
    }

    if (selectedStatuses.size > 0) {
      params.set("status", Array.from(selectedStatuses).join(","));
    }

    if (selectedOwner && !isMineFilter) {
      params.set("owner", selectedOwner);
    }

    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/api/rcfa?${params.toString()}`;
  }, [pagination, sorting, selectedStatuses, selectedOwner, search, isMineFilter]);

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
          console.error("Failed to fetch RCFAs:", err);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [buildApiUrl]);

  // Update URL when filters change (debounced for search)
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (pagination.pageIndex > 0) params.set("page", String(pagination.pageIndex + 1));
    if (search.trim()) params.set("q", search.trim());
    if (selectedStatuses.size > 0) params.set("status", Array.from(selectedStatuses).join(","));
    if (selectedOwner && !isMineFilter) params.set("owner", selectedOwner);
    if (isMineFilter) params.set("filter", "mine");
    if (sorting.length > 0) {
      const sortCol = sorting[0].id === "createdAt" ? "created_at" : sorting[0].id;
      if (sortCol !== "created_at") params.set("sortBy", sortCol);
      if (!sorting[0].desc) params.set("sortOrder", "asc");
    }

    const newUrl = `/dashboard/rcfas${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(newUrl, { scroll: false });
  }, [pagination.pageIndex, search, selectedStatuses, selectedOwner, isMineFilter, sorting, router]);

  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  // Toggle status filter
  const toggleStatus = (status: RcfaStatus) => {
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

  // Handle "mine" filter toggle
  const toggleMineFilter = () => {
    setIsMineFilter((prev) => !prev);
    if (!isMineFilter) {
      setSelectedOwner("");
    }
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Column definitions
  const columns = useMemo(
    () => [
      columnHelper.accessor("rcfaNumber", {
        header: "RCFA #",
        size: 100,
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
        cell: (info) => (
          <div className="max-w-[250px] truncate" title={info.getValue()}>
            {info.getValue() || "Untitled RCFA"}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        size: 120,
        enableColumnFilter: false,
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
        enableColumnFilter: false,
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        size: 100,
      }),
      columnHelper.accessor("equipmentDescription", {
        header: "Equipment",
        size: 200,
        cell: (info) => {
          const highlight = info.row.original.equipmentHighlight;
          if (highlight) {
            return (
              <div
                className="max-w-[200px] truncate text-xs"
                dangerouslySetInnerHTML={{ __html: highlight }}
              />
            );
          }
          return (
            <div className="max-w-[200px] truncate text-xs" title={info.getValue()}>
              {info.getValue()}
            </div>
          );
        },
      }),
      columnHelper.accessor("rootCauseCount", {
        header: "Root Causes",
        size: 100,
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("actionItemCount", {
        header: "Actions",
        size: 80,
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
    []
  );

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          placeholder="Search equipment or failure descriptions..."
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* "My RCFAs" toggle */}
        <button
          onClick={toggleMineFilter}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            isMineFilter
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          My RCFAs
        </button>

        {/* Status filter buttons */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedStatuses.has(status)
                  ? RCFA_STATUS_COLORS[status]
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {RCFA_STATUS_LABELS[status]}
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

        {/* Result count */}
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {totalRows} RCFA{totalRows !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyMessage={
          search
            ? "No RCFAs match your search."
            : selectedStatuses.size > 0 || selectedOwner || isMineFilter
              ? "No RCFAs match the selected filters."
              : "No RCFAs yet. Click 'New RCFA' to get started."
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
