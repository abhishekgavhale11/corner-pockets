import type { ReactNode } from "react";
import { historyUi } from "@/components/business-day/history/tokens";

export type HistoryColumn = {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

interface HistoryActivityTableProps {
  columns: HistoryColumn[];
  children: ReactNode;
  minWidth?: string;
  /** Optional section chrome around the table. */
  title?: ReactNode;
  titleTrailing?: ReactNode;
  footer?: ReactNode;
  /** When false, renders the table surface without the outer card wrapper. */
  framed?: boolean;
}

export function HistoryActivityTable({
  columns,
  children,
  minWidth = "960px",
  title,
  titleTrailing,
  footer,
  framed = true,
}: HistoryActivityTableProps) {
  const enableMinWidth = Boolean(minWidth) && minWidth !== "0";
  const table = (
    <>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          {typeof title === "string" ? (
            <h3 className={historyUi.sectionTitle}>{title}</h3>
          ) : (
            title
          )}
          {titleTrailing}
        </div>
      ) : null}
      <div className={enableMinWidth ? "overflow-x-auto" : "min-w-0 overflow-x-hidden"}>
        <table
          className="w-full border-collapse text-left text-sm"
          style={enableMinWidth ? { minWidth } : undefined}
        >
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/90">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${column.className ?? ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
      {footer}
    </>
  );

  if (!framed) return table;

  return (
    <section className={`${historyUi.card} overflow-hidden`}>{table}</section>
  );
}

interface HistoryTableRowProps {
  children: ReactNode;
}

export function HistoryTableRow({ children }: HistoryTableRowProps) {
  return (
    <tr className={`min-h-[54px] align-middle ${historyUi.rowHover}`}>
      {children}
    </tr>
  );
}

interface HistoryTableCellProps {
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export function HistoryTableCell({
  children,
  align = "left",
  className = "",
}: HistoryTableCellProps) {
  return (
    <td
      className={`px-3 py-2 ${
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
