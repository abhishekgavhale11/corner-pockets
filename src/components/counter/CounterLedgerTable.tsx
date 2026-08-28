import { cn } from "@/lib/utils/cn";

export function ledgerRowClass(showTypeColumn: boolean): string {
  return showTypeColumn ? "counter-ledger-row" : "counter-ledger-row-no-type";
}

export const ledgerCellTimeClass =
  "counter-ledger-time overflow-hidden py-2.5 pl-2 pr-0.5 text-left";
export const ledgerCellTypeClass =
  "counter-ledger-type min-w-0 overflow-hidden text-ellipsis whitespace-nowrap py-2.5 pl-1 pr-1 text-left";
export const ledgerCellCustomerClass =
  "counter-ledger-customer min-w-0 overflow-hidden py-2.5 pl-1 pr-0.5 text-left";
export const ledgerCellAmountClass =
  "counter-ledger-amount overflow-hidden whitespace-nowrap py-2.5 pl-0.5 pr-4 text-right";
export const ledgerCellDueClass =
  "counter-ledger-due overflow-hidden whitespace-nowrap py-2.5 pl-4 pr-1 text-left";
export const ledgerCellActionsClass =
  "counter-ledger-actions py-2.5 pl-0.5 pr-2 text-right";

const HEADER_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500";

function HeaderRow({ showTypeColumn }: { showTypeColumn: boolean }) {
  return (
    <tr className={ledgerRowClass(showTypeColumn)}>
      <th className={cn(ledgerCellTimeClass, HEADER_CELL, "py-2")}>Time</th>
      {showTypeColumn ? (
        <th className={cn(ledgerCellTypeClass, HEADER_CELL, "py-2")}>Type</th>
      ) : null}
      <th className={cn(ledgerCellCustomerClass, HEADER_CELL, "py-2")}>
        Customer
      </th>
      <th className={cn(ledgerCellAmountClass, HEADER_CELL, "py-2")}>Amount</th>
      <th className={cn(ledgerCellDueClass, HEADER_CELL, "py-2")}>Due</th>
      <th className={cn(ledgerCellActionsClass, HEADER_CELL, "py-2")}>
        Actions
      </th>
    </tr>
  );
}

interface CounterLedgerTableProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Pool & Mini: hide Type — the card header already identifies the table.
   * Big Snooker keeps Type (default true).
   */
  showTypeColumn?: boolean;
  /** When false, only the body rows render (column headers live in the frozen chrome). */
  showHeader?: boolean;
}

function LedgerTable({
  children,
  className,
  showTypeColumn,
  showHeader,
  headerBorderClass,
}: {
  children?: React.ReactNode;
  className?: string;
  showTypeColumn: boolean;
  showHeader: boolean;
  headerBorderClass: string;
}) {
  return (
    <div className="counter-ledger-container">
      <table
        className={cn("counter-ledger-table border-collapse", className)}
      >
        {showHeader ? (
          <thead className={headerBorderClass}>
            <HeaderRow showTypeColumn={showTypeColumn} />
          </thead>
        ) : null}
        {children ? <tbody>{children}</tbody> : null}
      </table>
    </div>
  );
}

/**
 * Counter frame ledger table. Column headers can sit in frozen table chrome;
 * the body lives in the shared frames scroller.
 */
export function CounterLedgerTable({
  children,
  className,
  showTypeColumn = true,
  showHeader = true,
}: CounterLedgerTableProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <LedgerTable
        showTypeColumn={showTypeColumn}
        showHeader={showHeader}
        headerBorderClass="border-b border-black/[0.05]"
      >
        {children}
      </LedgerTable>
    </div>
  );
}

/** Frozen Time / Type / Customer column headers above the shared frames scroller. */
export function CounterLedgerHeader({
  showTypeColumn = true,
}: {
  showTypeColumn?: boolean;
}) {
  return (
    <LedgerTable
      showTypeColumn={showTypeColumn}
      showHeader
      headerBorderClass="border-t border-black/[0.05]"
    />
  );
}

export function counterLedgerColSpan(showTypeColumn: boolean): number {
  return showTypeColumn ? 6 : 5;
}
