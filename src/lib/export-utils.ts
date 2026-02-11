import * as XLSX from "xlsx";

/**
 * Column definition for export functionality
 */
export type ExportColumn<T> = {
  /** Column header text */
  header: string;
  /** Key to access data from row object */
  accessor: keyof T | ((row: T) => string | number | null | undefined);
  /** Optional formatter for the value */
  format?: (value: unknown, row: T) => string | number;
};

/**
 * Generates a filename with current date
 */
function generateFilename(prefix: string, extension: "csv" | "xlsx"): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-export-${date}.${extension}`;
}

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports data to CSV format and triggers download
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filenamePrefix: string
): void {
  // Build header row
  const headers = columns.map((col) => escapeCSVValue(col.header));

  // Build data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const rawValue = typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor];
      const value = col.format ? col.format(rawValue, row) : rawValue;
      return escapeCSVValue(value);
    })
  );

  // Combine into CSV string
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = generateFilename(filenamePrefix, "csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to Excel format and triggers download
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filenamePrefix: string
): void {
  // Build worksheet data
  const wsData: (string | number | null)[][] = [];

  // Add header row
  wsData.push(columns.map((col) => col.header));

  // Add data rows
  data.forEach((row) => {
    const rowData = columns.map((col) => {
      const rawValue = typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor];
      const value = col.format ? col.format(rawValue, row) : rawValue;

      // Convert to appropriate type for Excel
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === "number") {
        return value;
      }
      return String(value);
    });
    wsData.push(rowData);
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns based on content
  const colWidths = columns.map((col, i) => {
    const headerLen = col.header.length;
    const dataLengths = wsData.slice(1).map((row) => String(row[i] ?? "").length);
    const maxDataLen = dataLengths.length > 0 ? Math.max(...dataLengths) : 0;
    return { wch: Math.min(Math.max(headerLen, maxDataLen) + 2, 50) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Data");

  // Write and download
  const filename = generateFilename(filenamePrefix, "xlsx");
  XLSX.writeFile(wb, filename);
}
