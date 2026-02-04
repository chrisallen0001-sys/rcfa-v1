"use client";

import { useId } from "react";

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Show inline (compact) style for use in card layouts */
  inline?: boolean;
  /** Optional label text */
  label?: string;
  /** Optional id override (auto-generated if not provided) */
  id?: string;
  /** Set min to today's date (useful for due dates) */
  minToday?: boolean;
  /** Custom className for the container */
  className?: string;
};

/**
 * Improved date input component with clear button and better UX.
 * Wraps native <input type="date"> for broad compatibility.
 */
export default function DateInput({
  value,
  onChange,
  disabled = false,
  inline = false,
  label,
  id: providedId,
  minToday = false,
  className = "",
}: DateInputProps) {
  const generatedId = useId();
  const inputId = providedId ?? generatedId;

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split("T")[0];

  const handleClear = () => {
    onChange("");
  };

  if (inline) {
    // Compact inline style for card layouts
    return (
      <label
        className={`flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
      >
        {label && <span>{label}</span>}
        <span className="relative inline-flex items-center">
          <input
            id={inputId}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            min={minToday ? today : undefined}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 pr-7 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 [color-scheme:light] dark:[color-scheme:dark]"
          />
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-1 flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Clear date"
              aria-label="Clear date"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </span>
      </label>
    );
  }

  // Form-style layout (used in forms with labels)
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}
      <div className="relative mt-1">
        <input
          id={inputId}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={minToday ? today : undefined}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 pr-9 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 [color-scheme:light] dark:[color-scheme:dark]"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Clear date"
            aria-label="Clear date"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
