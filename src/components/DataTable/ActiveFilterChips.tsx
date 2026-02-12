"use client";

import { useMemo } from "react";
import { type ColumnDef, type ColumnFiltersState } from "@tanstack/react-table";
import { parseDateRangeValue } from "./DateRangeFilter";
import type { FilterMeta } from "./ColumnFilter";

interface ActiveFilterChipsProps {
  columnFilters: ColumnFiltersState;
  /** Column definitions — uses any for value type to support mixed column types */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<any, any>[];
  onRemoveFilter: (columnId: string) => void;
  onClearAll: () => void;
  /** Status values that should be treated as "no filter" (hidden from chips) */
  defaultStatuses?: string[];
}

/**
 * Format a date-range filter value into a human-readable label.
 * Uses the same date formatting conventions as the DateRangeFilter display.
 */
function formatDateRange(value: string): string | null {
  const { mode, from, to } = parseDateRangeValue(value);

  const currentYear = new Date().getFullYear();

  const formatDate = (iso: string): string => {
    // Parse as local date (yyyy-MM-dd) to avoid timezone shifts
    const [year, month, day] = iso.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions =
      d.getFullYear() === currentYear
        ? { month: "short", day: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" };
    return d.toLocaleDateString("en-US", options);
  };

  if (mode === "after" && from) {
    return `After ${formatDate(from)}`;
  }
  if (mode === "before" && to) {
    return `Before ${formatDate(to)}`;
  }
  if (mode === "range" && from && to) {
    return `${formatDate(from)} \u2013 ${formatDate(to)}`;
  }
  return null;
}

/**
 * Resolve multi-select values to display labels using filterOptions.
 * Falls back to raw values when options are unavailable (e.g., async data not loaded yet).
 */
function resolveMultiSelectLabels(
  values: string[],
  filterOptions?: { label: string; value: string }[]
): string {
  if (!filterOptions || filterOptions.length === 0) {
    return values.join(", ");
  }
  const optionMap = new Map(filterOptions.map((o) => [o.value, o.label]));
  return values.map((v) => optionMap.get(v) ?? v).join(", ");
}

/**
 * Check whether a multi-select status filter matches the default statuses,
 * meaning it should be hidden from the chips bar.
 */
function isDefaultStatusFilter(
  filterValue: string[],
  defaultStatuses: string[]
): boolean {
  if (filterValue.length !== defaultStatuses.length) return false;
  const sorted = [...filterValue].sort();
  const defaultSorted = [...defaultStatuses].sort();
  return sorted.every((v, i) => v === defaultSorted[i]);
}

export default function ActiveFilterChips({
  columnFilters,
  columns,
  onRemoveFilter,
  onClearAll,
  defaultStatuses,
}: ActiveFilterChipsProps) {
  // Build a lookup from column ID to column definition for header text and meta
  const columnMap = useMemo(() => {
    const map = new Map<string, { header: string; meta?: FilterMeta }>();
    for (const col of columns) {
      // accessorKey is available on accessor columns
      const id =
        ("accessorKey" in col ? (col.accessorKey as string) : undefined) ??
        col.id;
      if (id) {
        map.set(id, {
          header: typeof col.header === "string" ? col.header : id,
          meta: col.meta as FilterMeta | undefined,
        });
      }
    }
    return map;
  }, [columns]);

  // Build chip data for each active filter
  const chips = useMemo(() => {
    const result: { columnId: string; label: string }[] = [];

    for (const filter of columnFilters) {
      const colInfo = columnMap.get(filter.id);
      const headerLabel = colInfo?.header ?? filter.id;
      const meta = colInfo?.meta;
      const filterType = meta?.filterType ?? "text";

      // Select filters (single value from dropdown)
      if (filterType === "select" && typeof filter.value === "string" && filter.value.length > 0) {
        const option = meta?.filterOptions?.find((o) => o.value === filter.value);
        const displayValue = option?.label ?? filter.value;
        result.push({ columnId: filter.id, label: `${headerLabel}: ${displayValue}` });
        continue;
      }

      // Multi-select filters (including status)
      if (filterType === "multi-select" && Array.isArray(filter.value)) {
        const values = filter.value as string[];

        // Hide the status chip when it matches defaults
        if (
          filter.id === "status" &&
          defaultStatuses &&
          isDefaultStatusFilter(values, defaultStatuses)
        ) {
          continue;
        }

        if (values.length === 0) continue;

        const resolved = resolveMultiSelectLabels(values, meta?.filterOptions);
        // Truncate long lists: show first 2 labels then "+N more"
        const MAX_VISIBLE = 2;
        let displayValue: string;
        if (values.length > MAX_VISIBLE) {
          const visibleLabels = resolveMultiSelectLabels(
            values.slice(0, MAX_VISIBLE),
            meta?.filterOptions
          );
          displayValue = `${visibleLabels}, +${values.length - MAX_VISIBLE} more`;
        } else {
          displayValue = resolved;
        }
        result.push({ columnId: filter.id, label: `${headerLabel}: ${displayValue}` });
        continue;
      }

      // Date-range filters
      if (filterType === "date-range" && typeof filter.value === "string") {
        const displayValue = formatDateRange(filter.value);
        if (!displayValue) continue;
        result.push({ columnId: filter.id, label: `${headerLabel}: ${displayValue}` });
        continue;
      }

      // Text filters
      if (typeof filter.value === "string" && filter.value.length > 0) {
        result.push({ columnId: filter.id, label: `${headerLabel}: ${filter.value}` });
      }
    }

    return result;
  }, [columnFilters, columnMap, defaultStatuses]);

  if (chips.length === 0) return null;

  return (
    <div role="region" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.columnId}
          className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemoveFilter(chip.columnId)}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            aria-label={`Remove ${chip.label} filter`}
          >
            &times;
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        Clear all
      </button>
    </div>
  );
}
