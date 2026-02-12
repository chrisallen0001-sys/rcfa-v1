import { type FilterFn } from "@tanstack/react-table";
import { parseDateRangeValue } from "./DateRangeFilter";

/**
 * Client-side filter function for multi-select columns.
 * Expects filterValue to be a string[] of selected values.
 * Cell values may be a single string or an array of strings.
 */
export const multiSelectFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: string[]
) => {
  const cellValue = row.getValue(columnId);
  if (Array.isArray(cellValue)) {
    return cellValue.some((v) => filterValue.includes(v as string));
  }
  return filterValue.includes(cellValue as string);
};

/**
 * Client-side filter function for date-range columns.
 * Expects filterValue to be a serialized string (e.g. "after:2025-01-15").
 * Cell values should be ISO date strings (yyyy-MM-dd) for correct comparison.
 */
export const dateRangeFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: string
) => {
  const cellValue = row.getValue(columnId) as string;
  if (!cellValue) return false;

  const { mode, from, to } = parseDateRangeValue(filterValue);

  if (mode === "after" && from) return cellValue >= from;
  if (mode === "before" && to) return cellValue <= to;
  if (mode === "range" && from && to)
    return cellValue >= from && cellValue <= to;

  return true;
};
