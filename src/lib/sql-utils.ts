export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Escape LIKE/ILIKE wildcard characters (`%`, `_`, `\`) in user input. */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Validates an ISO date string (yyyy-MM-dd) both syntactically and semantically.
 * Returns true if the string is a valid calendar date.
 */
export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  return !isNaN(new Date(value).getTime());
}

/**
 * Normalise a user-entered number filter value so partial/formatted input
 * (e.g. "RCFA-049", "AI-003") matches the raw integer stored in the DB.
 *
 * 1. Strips a known prefix (case-insensitive).
 * 2. Removes leading zeros so "049" becomes "49".
 * 3. Falls through to the original value when no prefix is detected.
 */
export function stripNumericPrefix(
  value: string,
  prefix: string,
): string {
  const stripped = value.toLowerCase().startsWith(prefix.toLowerCase())
    ? value.slice(prefix.length)
    : value;
  // Remove leading zeros but keep at least one digit ("000" → "0")
  const noLeadingZeros = stripped.replace(/^0+(?=\d)/, "");
  return noLeadingZeros;
}
