import type { ReactNode } from "react";
import { TableSkeleton } from "./Skeleton";

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  testIdPrefix?: string;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  isLoading,
  emptyMessage = "No records found",
  onRowClick,
  testIdPrefix = "row",
}: DataTableProps<T>) {
  return (
    <div className="border border-border rounded overflow-hidden bg-card">
      <div
        className="grid gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <div key={col.key} className={col.className}>
            {col.header}
          </div>
        ))}
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <TableSkeleton rows={5} cols={columns.length} />
        ) : data && data.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        ) : (
          data?.map((item) => (
            <div
              key={item.id}
              data-testid={`${testIdPrefix}-${item.id}`}
              className="grid gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(item); } } : undefined}
              aria-pressed={onRowClick ? false : undefined}
              aria-label={onRowClick ? `Select row ${item.id}` : undefined}
            >
              {columns.map((col) => (
                <div key={col.key} className={col.className}>
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? "—")}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}