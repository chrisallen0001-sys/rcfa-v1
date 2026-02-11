"use client";

import { type Table } from "@tanstack/react-table";

interface TablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
  /** For server-side pagination, pass the total row count */
  totalRows?: number;
}

export default function TablePagination<TData>({
  table,
  pageSizeOptions = [10, 25, 50],
  totalRows,
}: TablePaginationProps<TData>) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();

  // Calculate row range for display
  const totalRowCount = totalRows ?? table.getFilteredRowModel().rows.length;
  const startRow = totalRowCount > 0 ? pageIndex * pageSize + 1 : 0;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRowCount);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
      {/* Row count info */}
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing {startRow}–{endRow} of {totalRowCount} results
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-2">
        {/* Page size selector */}
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="hidden sm:inline">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Go to first page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Go to previous page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page indicator */}
          <span className="px-2 text-sm text-zinc-700 dark:text-zinc-300">
            Page {pageIndex + 1} of {pageCount || 1}
          </span>

          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Go to next page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Go to last page"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
