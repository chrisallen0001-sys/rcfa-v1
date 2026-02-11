export { default as DataTable } from "./DataTable";
export type { DataTableProps } from "./DataTable";
export { default as TableHeader } from "./TableHeader";
export { default as TablePagination } from "./TablePagination";
export { default as ColumnFilter } from "./ColumnFilter";

// Re-export useful types from TanStack Table for column definitions
export {
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
