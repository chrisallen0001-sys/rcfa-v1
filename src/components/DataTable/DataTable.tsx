"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type OnChangeFn,
} from "@tanstack/react-table";
import { useState, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import TableHeader from "./TableHeader";
import TablePagination from "./TablePagination";

export interface DataTableProps<TData> {
  /** Column definitions for the table - uses any for value type to support mixed column types */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  /** Data rows to display */
  data: TData[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Message to show when no data */
  emptyMessage?: string;
  /** Initial page size (default: 10) */
  pageSize?: number;
  /** Page size options for pagination (default: [10, 25, 50]) */
  pageSizeOptions?: number[];
  /** Whether to show pagination (default: true) */
  showPagination?: boolean;
  /** Whether to enable column filters (default: true) */
  enableFilters?: boolean;
  /** Server-side pagination: total row count */
  totalRows?: number;
  /** Server-side pagination: current page index */
  pageIndex?: number;
  /** Server-side pagination: callback for pagination changes */
  onPaginationChange?: OnChangeFn<PaginationState>;
  /** Server-side sorting: callback for sorting changes */
  onSortingChange?: OnChangeFn<SortingState>;
  /** Server-side filtering: callback for filter changes */
  onFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** Whether pagination is server-side controlled (default: false) */
  manualPagination?: boolean;
  /** Whether sorting is server-side controlled (default: false) */
  manualSorting?: boolean;
  /** Whether filtering is server-side controlled (default: false) */
  manualFiltering?: boolean;
  /** Controlled column filters state (pass when manualFiltering is true to sync filter UI with parent) */
  columnFilters?: ColumnFiltersState;
}

function LoadingSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <tr key={rowIdx} className="animate-pulse">
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data found.",
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  showPagination = true,
  enableFilters = true,
  totalRows,
  pageIndex: controlledPageIndex,
  onPaginationChange,
  onSortingChange,
  onFiltersChange,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  columnFilters: controlledColumnFilters,
}: DataTableProps<TData>) {
  // Internal state for client-side mode
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: controlledPageIndex ?? 0,
    pageSize,
  });

  // Use controlled column filters when provided (server-side filtering),
  // otherwise fall back to internal state (client-side filtering).
  const isControlledFilters = controlledColumnFilters !== undefined;
  const effectiveColumnFilters = isControlledFilters ? controlledColumnFilters : internalColumnFilters;

  // Use controlled or internal state
  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater);
    onSortingChange?.(updater);
  };

  const handleFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    if (isControlledFilters) {
      // Controlled mode: only forward to parent, no internal state update
      onFiltersChange?.(updater);
    } else {
      setInternalColumnFilters(updater);
      onFiltersChange?.(updater);
    }
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination(updater);
    onPaginationChange?.(updater);
  };

  // Memoize data to prevent unnecessary re-renders
  const tableData = useMemo(() => data, [data]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters: effectiveColumnFilters,
      pagination: manualPagination
        ? { pageIndex: controlledPageIndex ?? 0, pageSize: pagination.pageSize }
        : pagination,
    },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleFiltersChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount: manualPagination && totalRows
      ? Math.ceil(totalRows / pagination.pageSize)
      : undefined,
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  // Preserve scroll position and table dimensions across re-renders (e.g. when filters change)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef(0);
  const contentHeightRef = useRef(0);
  const contentWidthRef = useRef(0);
  const isRestoringScroll = useRef(false);
  const prevIsLoading = useRef(isLoading);

  // Capture horizontal scroll position — skip browser-initiated clamp events during loading
  const handleScroll = useCallback(() => {
    if (isRestoringScroll.current) return;
    if (scrollContainerRef.current) {
      scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    }
  }, []);

  // Derive a stable key for client-side filtering (rows change without data/isLoading changing)
  const rowCount = rows.length;

  // Restore horizontal scroll and capture content dimensions after table content changes
  useLayoutEffect(() => {
    // When transitioning into loading, freeze scroll capture so the skeleton's
    // narrower content doesn't overwrite the saved user position via onScroll.
    if (isLoading && !prevIsLoading.current) {
      isRestoringScroll.current = true;
    }
    prevIsLoading.current = isLoading;

    const el = scrollContainerRef.current;
    if (!el) return;

    // When not loading, capture real content dimensions for use as min-height/min-width during loading
    if (!isLoading) {
      contentHeightRef.current = el.offsetHeight;
      contentWidthRef.current = el.scrollWidth;
    }

    // Restore horizontal scroll position, clamped to content width
    isRestoringScroll.current = true;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollLeft = Math.min(scrollLeftRef.current, maxScroll);
    // Re-enable user scroll capture after the browser processes the programmatic assignment
    requestAnimationFrame(() => {
      isRestoringScroll.current = false;
    });
  }, [isLoading, data, rowCount]);

  return (
    <div className="w-full">
      {/* Outer scroll wrapper — overflow-x:auto provides horizontal scrolling
          on narrow viewports.  It has no constrained height so it does NOT
          become the vertical scroll ancestor; the viewport remains the
          vertical scroll context and position:sticky on the thead still
          works relative to the viewport. */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto"
      >
        {/* Inner border wrapper — overflow-x:clip keeps the rounded corners
            intact without creating a scroll container (clip does not
            establish a scroll context). */}
        <div
          style={isLoading && contentHeightRef.current > 0 ? { minHeight: contentHeightRef.current } : undefined}
          className="rounded-lg border border-zinc-200 [overflow-x:clip] dark:border-zinc-800"
        >
          <table
            style={isLoading && contentWidthRef.current > 0 ? { minWidth: contentWidthRef.current } : undefined}
            className="w-full min-w-[600px] text-sm"
          >
            <thead
              className="sticky z-20 border-b border-zinc-200 bg-zinc-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
              style={{ top: "var(--app-header-h, 0px)" }}
            >
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeader
                      key={header.id}
                      header={header}
                      enableFilters={enableFilters}
                    />
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {isLoading ? (
                <LoadingSkeleton columnCount={columns.length} />
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="whitespace-nowrap px-4 py-3 text-zinc-900 dark:text-zinc-100"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && !isLoading && rows.length > 0 && (
        <TablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          totalRows={manualPagination ? totalRows : undefined}
        />
      )}
    </div>
  );
}
