"use client";

import { useState, useCallback, useMemo } from "react";

interface CurrencyInputProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Currency input that formats as USD on blur and shows raw number on focus.
 * Empty values remain empty (no $0.00 placeholder).
 */
export default function CurrencyInput({
  name,
  value,
  onChange,
  placeholder = "$0.00",
  className = "",
  disabled = false,
}: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Format for display when not focused
  const displayValue = useMemo(() => {
    if (isFocused || value === "") return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return currencyFormatter.format(num);
  }, [value, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Prevent negative numbers
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-") {
      e.preventDefault();
    }
  }, []);

  return (
    <input
      type={isFocused ? "number" : "text"}
      name={name}
      value={displayValue}
      onChange={onChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      min="0"
      step="0.01"
      disabled={disabled}
      className={className}
    />
  );
}
