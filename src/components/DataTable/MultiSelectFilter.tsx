"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { type Column } from "@tanstack/react-table";

interface MultiSelectFilterProps<TData> {
  column: Column<TData, unknown>;
  options: { label: string; value: string }[];
  colorMap?: Record<string, string>;
}

export default function MultiSelectFilter<TData>({
  column,
  options,
  colorMap,
}: MultiSelectFilterProps<TData>) {
  const rawSelected = column.getFilterValue() as string[] | undefined;
  const selected = useMemo(() => rawSelected ?? [], [rawSelected]);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(
    (value: string) => {
      const next = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      column.setFilterValue(next.length > 0 ? next : undefined);
    },
    [column, selected]
  );

  const clear = useCallback(() => {
    column.setFilterValue(undefined);
    setIsOpen(false);
  }, [column]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Compute popover position
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 240;

    setPopoverStyle({
      position: "fixed",
      left: rect.left,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 50,
      minWidth: Math.max(rect.width, 180),
    });
  }, [isOpen]);

  const label =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full truncate rounded border px-2 py-1 text-left text-xs transition-colors ${
          selected.length > 0
            ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300"
            : "border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        {label}
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {options.map((option) => {
              const isChecked = selected.includes(option.value);
              const colorClass = colorMap?.[option.value];

              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(option.value)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                  />
                  {colorClass ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {option.label}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {option.label}
                    </span>
                  )}
                </label>
              );
            })}

            {selected.length > 0 && (
              <div className="border-t border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
