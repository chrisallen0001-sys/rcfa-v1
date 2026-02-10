"use client";

import { useId, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import "react-day-picker/style.css";

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
  /** Set min to today's date for new dates (existing past dates can still be edited) */
  minToday?: boolean;
  /** Custom className for the container */
  className?: string;
};

/** Clear (X) icon for the clear button */
function ClearIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={sizeClass}
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/** Calendar icon */
function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Improved date input component with react-day-picker for better UX.
 * Fixes the issue where native date picker closes on month navigation.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Get default class names from react-day-picker (memoized)
  const defaultClassNames = useMemo(() => getDefaultClassNames(), []);

  // Parse the value string to a Date object
  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  // Calculate min date fresh when calendar is open to avoid stale date reference
  // (e.g., if user leaves page open overnight)
  const minDate = minToday && !value && isOpen ? new Date() : undefined;

  // Format date for display
  const displayValue = selectedDate ? format(selectedDate, "MM/dd/yyyy") : "";

  // Handle date selection from calendar
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
    }
    setIsOpen(false);
  };

  // Handle clear button
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange("");
    setIsOpen(false);
  };

  // Calculate dropdown position when opening
  useEffect(() => {
    if (!isOpen || !inputRef.current) return;

    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    });
  }, [isOpen]);

  // Close on outside click (check both container and portal calendar)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideCalendar = calendarRef.current?.contains(target);
      if (!isInsideContainer && !isInsideCalendar) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Handle keyboard navigation for accessibility
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const inputBaseClass = inline
    ? "rounded-md border border-zinc-300 bg-white px-2 py-1 pr-14 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
    : "block w-full rounded-md border border-zinc-300 px-3 py-2 pr-16 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer";

  // Render calendar dropdown via portal to avoid overflow clipping
  const calendarPortal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={calendarRef}
            className="fixed z-50 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          >
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              defaultMonth={selectedDate}
              disabled={minDate ? { before: minDate } : undefined}
              classNames={{
                root: `${defaultClassNames.root} text-zinc-900 dark:text-zinc-100`,
                today: `${defaultClassNames.today} font-bold`,
                selected: `${defaultClassNames.selected} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`,
                chevron: `${defaultClassNames.chevron} fill-zinc-600 dark:fill-zinc-400`,
              }}
            />
            <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => handleSelect(new Date())}
                className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  if (inline) {
    return (
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {label && <span>{label}</span>}
          <div className="relative">
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              readOnly
              value={displayValue}
              placeholder="Select date"
              disabled={disabled}
              onClick={() => !disabled && setIsOpen(!isOpen)}
              onKeyDown={handleInputKeyDown}
              className={inputBaseClass}
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {value && !disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={handleClear}
                  className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Clear date"
                  aria-label="Clear date"
                >
                  <ClearIcon size="sm" />
                </button>
              )}
              <span className="flex h-5 w-5 items-center justify-center text-zinc-400">
                <CalendarIcon />
              </span>
            </div>
          </div>
        </label>
        {calendarPortal}
      </div>
    );
  }

  // Form-style layout
  return (
    <div ref={containerRef} className={`relative ${className}`}>
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
          ref={inputRef}
          id={inputId}
          type="text"
          readOnly
          value={displayValue}
          placeholder="Select date"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleInputKeyDown}
          className={inputBaseClass}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={handleClear}
              className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Clear date"
              aria-label="Clear date"
            >
              <ClearIcon size="md" />
            </button>
          )}
          <span className="flex h-5 w-5 items-center justify-center text-zinc-400">
            <CalendarIcon />
          </span>
        </div>
      </div>
      {calendarPortal}
    </div>
  );
}
