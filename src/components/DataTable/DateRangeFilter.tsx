"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { type Column } from "@tanstack/react-table";
import { usePopoverDismiss } from "@/hooks/usePopoverDismiss";
import { usePopoverPosition } from "@/hooks/usePopoverPosition";
import "react-day-picker/style.css";

type DateRangeMode = "after" | "before" | "range";

const EPOCH = new Date(0);

/** Parse an ISO date string (yyyy-MM-dd) to a Date, or undefined if invalid. */
function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  const d = parse(str, "yyyy-MM-dd", EPOCH);
  return isValid(d) ? d : undefined;
}

/**
 * Parses a serialized date range filter value.
 * Formats: "after:2025-01-15", "before:2025-06-01", "range:2025-01-01,2025-03-31"
 */
export function parseDateRangeValue(value: string): {
  mode: DateRangeMode;
  from?: string;
  to?: string;
} {
  if (value.startsWith("after:")) {
    return { mode: "after", from: value.slice(6) };
  }
  if (value.startsWith("before:")) {
    return { mode: "before", to: value.slice(7) };
  }
  if (value.startsWith("range:")) {
    const [from, to] = value.slice(6).split(",");
    return { mode: "range", from, to };
  }
  // Fallback for unexpected formats — default to "after" mode with no date
  // so the UI stays usable rather than crashing.
  return { mode: "after" };
}

/**
 * Serializes a date range filter value to a string.
 */
export function serializeDateRange(
  mode: DateRangeMode,
  from?: string,
  to?: string
): string | undefined {
  if (mode === "after" && from) return `after:${from}`;
  if (mode === "before" && to) return `before:${to}`;
  if (mode === "range" && from && to) return `range:${from},${to}`;
  return undefined;
}

interface DateRangeFilterProps<TData> {
  column: Column<TData, unknown>;
}

const MODE_LABELS: Record<DateRangeMode, string> = {
  after: "After",
  before: "Before",
  range: "Range",
};

/**
 * Format a date for the compact button label, including the year
 * when it differs from the current year.
 */
function formatShortDate(d: Date): string {
  const currentYear = new Date().getFullYear();
  return d.getFullYear() === currentYear
    ? format(d, "MMM d")
    : format(d, "MMM d, yyyy");
}

export default function DateRangeFilter<TData>({
  column,
}: DateRangeFilterProps<TData>) {
  const filterValue = column.getFilterValue() as string | undefined;
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  // Refs are stable across renders; empty deps is intentional.
  const dismissRefs = useMemo(() => [buttonRef, popoverRef], []);

  usePopoverDismiss(isOpen, close, dismissRefs);
  const popoverStyle = usePopoverPosition(isOpen, buttonRef, {
    spaceThreshold: 380,
    width: 288,
  });

  // Parse current committed filter value for display label
  const parsed = useMemo(
    () => (filterValue ? parseDateRangeValue(filterValue) : null),
    [filterValue]
  );

  // Local editing state — only used while popover is open
  const [mode, setMode] = useState<DateRangeMode>("after");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const defaultClassNames = useMemo(() => getDefaultClassNames(), []);

  const apply = useCallback(() => {
    const serialized = serializeDateRange(mode, fromDate, toDate);
    column.setFilterValue(serialized);
    setIsOpen(false);
  }, [column, mode, fromDate, toDate]);

  const clear = useCallback(() => {
    column.setFilterValue(undefined);
    setFromDate("");
    setToDate("");
    setIsOpen(false);
  }, [column]);

  // Display label
  const displayLabel = useMemo(() => {
    if (!parsed) return "All dates";
    if (parsed.mode === "after" && parsed.from) {
      const d = parseDate(parsed.from);
      return d ? `After ${formatShortDate(d)}` : "All dates";
    }
    if (parsed.mode === "before" && parsed.to) {
      const d = parseDate(parsed.to);
      return d ? `Before ${formatShortDate(d)}` : "All dates";
    }
    if (parsed.mode === "range" && parsed.from && parsed.to) {
      const f = parseDate(parsed.from);
      const t = parseDate(parsed.to);
      return f && t
        ? `${formatShortDate(f)} – ${formatShortDate(t)}`
        : "All dates";
    }
    return "All dates";
  }, [parsed]);

  // Handle single-mode day selection (after/before)
  const handleDaySelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    if (mode === "after") {
      setFromDate(iso);
    } else {
      setToDate(iso);
    }
  };

  const calendarMonth = useMemo(() => {
    if (fromDate) return parseDate(fromDate);
    if (toDate) return parseDate(toDate);
    return undefined;
  }, [fromDate, toDate]);

  // Check if Apply should be enabled
  const canApply =
    (mode === "after" && fromDate) ||
    (mode === "before" && toDate) ||
    (mode === "range" && fromDate && toDate);

  // Summary text for the footer — mode-aware to avoid blank state
  const summaryText = (() => {
    if (mode === "after" && fromDate) return `After ${fromDate}`;
    if (mode === "before" && toDate) return `Before ${toDate}`;
    if (mode === "range" && fromDate && !toDate) return `From ${fromDate}…`;
    if (mode === "range" && fromDate && toDate)
      return `${fromDate} – ${toDate}`;
    return "Select a date";
  })();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) {
            // Initialize editing state from committed filter value
            if (filterValue) {
              const p = parseDateRangeValue(filterValue);
              setMode(p.mode);
              setFromDate(p.from ?? "");
              setToDate(p.to ?? "");
            } else {
              setMode("after");
              setFromDate("");
              setToDate("");
            }
          }
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`w-full truncate rounded border px-2 py-1 text-left text-xs transition-colors ${
          filterValue
            ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300"
            : "border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        {displayLabel}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Date range filter"
            style={popoverStyle}
            className="rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* Mode tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-700">
              {(["after", "before", "range"] as DateRangeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setFromDate("");
                    setToDate("");
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    mode === m
                      ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="flex justify-center p-2">
              {mode === "range" ? (
                <DayPicker
                  mode="range"
                  selected={
                    fromDate && toDate
                      ? { from: parseDate(fromDate)!, to: parseDate(toDate)! }
                      : fromDate
                        ? { from: parseDate(fromDate)!, to: undefined }
                        : undefined
                  }
                  onSelect={(range) => {
                    if (!range) {
                      setFromDate("");
                      setToDate("");
                    } else {
                      // Always set both fields so a stale toDate from a
                      // previous selection is cleared when starting a new range.
                      setFromDate(
                        range.from ? format(range.from, "yyyy-MM-dd") : ""
                      );
                      setToDate(
                        range.to ? format(range.to, "yyyy-MM-dd") : ""
                      );
                    }
                  }}
                  defaultMonth={calendarMonth}
                  classNames={{
                    root: `${defaultClassNames.root} text-zinc-900 dark:text-zinc-100 text-xs`,
                    today: `${defaultClassNames.today} font-bold`,
                    selected: `${defaultClassNames.selected} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`,
                    range_start: `${defaultClassNames.range_start} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`,
                    range_end: `${defaultClassNames.range_end} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`,
                    range_middle: `${defaultClassNames.range_middle} bg-zinc-200 dark:bg-zinc-700`,
                    chevron: `${defaultClassNames.chevron} fill-zinc-600 dark:fill-zinc-400`,
                  }}
                />
              ) : (
                <DayPicker
                  mode="single"
                  selected={
                    mode === "after" ? parseDate(fromDate) : parseDate(toDate)
                  }
                  onSelect={handleDaySelect}
                  defaultMonth={calendarMonth}
                  classNames={{
                    root: `${defaultClassNames.root} text-zinc-900 dark:text-zinc-100 text-xs`,
                    today: `${defaultClassNames.today} font-bold`,
                    selected: `${defaultClassNames.selected} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`,
                    chevron: `${defaultClassNames.chevron} fill-zinc-600 dark:fill-zinc-400`,
                  }}
                />
              )}
            </div>

            {/* Summary + Actions */}
            <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {summaryText}
              </span>
              <div className="flex gap-2">
                {filterValue && (
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={apply}
                  disabled={!canApply}
                  className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
