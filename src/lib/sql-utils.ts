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
