"use client";

import { type Header, flexRender } from "@tanstack/react-table";
import ColumnFilter from "./ColumnFilter";

interface TableHeaderProps<TData> {
  header: Header<TData, unknown>;
  enableFilters?: boolean;
}

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (!direction) {
    return (
      <svg
        className="ml-1 h-4 w-4 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    );
  }

  return (
    <svg
      className="ml-1 h-4 w-4 text-zinc-700 dark:text-zinc-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      {direction === "asc" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      )}
    </svg>
  );
}

export default function TableHeader<TData>({
  header,
  enableFilters = true,
}: TableHeaderProps<TData>) {
  const canSort = header.column.getCanSort();
  const isSorted = header.column.getIsSorted();
  const canFilter = header.column.getCanFilter() && enableFilters;

  const handleSort = () => {
    if (canSort) {
      header.column.toggleSorting();
    }
  };

  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
    >
      <div className="flex flex-col gap-2">
        {/* Header label with sort toggle */}
        {header.isPlaceholder ? null : (
          <div className="flex items-center">
            {canSort ? (
              <button
                type="button"
                className="group flex cursor-pointer items-center hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={handleSort}
                aria-label={`Sort by ${header.column.id}`}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                <SortIcon direction={isSorted} />
              </button>
            ) : (
              <span>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            )}
          </div>
        )}

        {/* Column filter */}
        {canFilter && <ColumnFilter column={header.column} />}
      </div>
    </th>
  );
}
