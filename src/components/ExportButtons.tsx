"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ExportFormat = "csv" | "xlsx";

interface ExportButtonsProps {
  onExport: (format: ExportFormat) => void | Promise<void>;
  disabled?: boolean;
  /** Number of rows that will be exported (shown in dropdown hint) */
  rowCount?: number;
}

const MENU_ITEMS: { format: ExportFormat; label: string }[] = [
  { format: "csv", label: "Export as CSV" },
  { format: "xlsx", label: "Export as Excel" },
];

/**
 * Export dropdown button with CSV and Excel options
 */
export default function ExportButtons({
  onExport,
  disabled = false,
  rowCount,
}: ExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus first menu item when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
      buttonRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    setIsOpen(false);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          break;
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = (prev + 1) % MENU_ITEMS.length;
            buttonRefs.current[next]?.focus();
            return next;
          });
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) => {
            const next = (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
            buttonRefs.current[next]?.focus();
            return next;
          });
          break;
        case "Tab":
          // Allow tab to close dropdown and move focus naturally
          setIsOpen(false);
          break;
      }
    },
    [isOpen]
  );

  // Handle keyboard on trigger button
  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown" && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    },
    [isOpen]
  );

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled || isExporting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {isExporting ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
            <svg
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="py-1">
            {rowCount !== undefined && (
              <div className="px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {rowCount} {rowCount === 1 ? "row" : "rows"} will be exported
              </div>
            )}
            <button
              ref={(el) => { buttonRefs.current[0] = el; }}
              type="button"
              role="menuitem"
              tabIndex={focusedIndex === 0 ? 0 : -1}
              onClick={() => handleExport("csv")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as CSV
            </button>
            <button
              ref={(el) => { buttonRefs.current[1] = el; }}
              type="button"
              role="menuitem"
              tabIndex={focusedIndex === 1 ? 0 : -1}
              onClick={() => handleExport("xlsx")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
