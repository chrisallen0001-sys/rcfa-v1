/**
 * Formats an RCFA number for display.
 * @param rcfaNumber - The numeric RCFA identifier
 * @returns Formatted string like "RCFA-001"
 */
export function formatRcfaNumber(rcfaNumber: number): string {
  return `RCFA-${String(rcfaNumber).padStart(3, "0")}`;
}
