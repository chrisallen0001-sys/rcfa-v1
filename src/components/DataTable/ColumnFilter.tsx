"use client";

import { type Column } from "@tanstack/react-table";
import { useCallback, useRef } from "react";

interface ColumnFilterProps<TData> {
  column: Column<TData, unknown>;
}

/**
 * Filter types supported by the column filter.
 * Set via column meta: { filterType: "text" | "select", filterOptions: [...] }
 */
type FilterMeta = {
  filterType?: "text" | "select";
  filterOptions?: { label: string; value: string }[];
  filterPlaceholder?: string;
};

export default function ColumnFilter<TData>({ column }: ColumnFilterProps<TData>) {
  const meta = column.columnDef.meta as FilterMeta | undefined;
  const filterType = meta?.filterType ?? "text";
  const filterOptions = meta?.filterOptions;
  const placeholder = meta?.filterPlaceholder ?? "Filter...";

  const columnFilterValue = column.getFilterValue() as string | undefined;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced text filter update
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the filter update
      debounceRef.current = setTimeout(() => {
        column.setFilterValue(value || undefined);
      }, 300);
    },
    [column]
  );

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      column.setFilterValue(e.target.value || undefined);
    },
    [column]
  );

  if (filterType === "select" && filterOptions) {
    return (
      <select
        value={columnFilterValue ?? ""}
        onChange={handleSelectChange}
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <option value="">All</option>
        {filterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  // For text filter, use uncontrolled input with defaultValue
  // This avoids needing to sync React state with external filter state
  return (
    <input
      ref={inputRef}
      key={columnFilterValue === undefined ? "empty" : "filled"}
      type="text"
      defaultValue={columnFilterValue ?? ""}
      onChange={handleTextChange}
      placeholder={placeholder}
      className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
    />
  );
}
