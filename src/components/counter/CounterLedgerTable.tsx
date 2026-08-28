import { cn } from "@/lib/utils/cn";

const COL_TIME = "3rem";
const COL_TYPE = "2.5rem";
const COL_AMOUNT = "3.75rem";
const COL_DUE = "4rem";
const COL_ACTIONS = "3.5rem";

function LedgerColgroup({ showTypeColumn }: { showTypeColumn: boolean }) {
  return (
    <colgroup>
      <col style={{ width: COL_TIME }} />
      {showTypeColumn ? <col style={{ width: COL_TYPE }} /> : null}
      <col />
      <col style={{ width: COL_AMOUNT }} />
      <col style={{ width: COL_DUE }} />
      <col style={{ width: COL_ACTIONS }} />
    </colgroup>
  );
}

export const ledgerCellTimeClass =
  "overflow-hidden py-2.5 pl-2 pr-0.5 text-left";
export const ledgerCellTypeClass =
  "min-w-0 overflow-hidden px-1 py-2.5 text-left";
export const ledgerCellCustomerClass =
  "min-w-0 overflow-hidden px-1.5 py-2.5 text-left";
export const ledgerCellAmountClass =
  "overflow-hidden whitespace-nowrap px-1 py-2.5 text-right";
export const ledgerCellDueClass =
  "overflow-hidden whitespace-nowrap px-1 py-2.5 text-left";
export const ledgerCellActionsClass = "py-2.5 pl-0.5 pr-2 text-right";

const HEADER_CELL =
  "overflow-hidden text-ellipsis whitespace-nowrap py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500";

function HeaderRow({ showTypeColumn }: { showTypeColumn: boolean }) {
  return (
    <tr>
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
    <table
      className={cn("w-full min-w-0 table-fixed border-collapse", className)}
    >
      <LedgerColgroup showTypeColumn={showTypeColumn} />
      {showHeader ? (
        <thead className={headerBorderClass}>
          <HeaderRow showTypeColumn={showTypeColumn} />
        </thead>
      ) : null}
      {children ? <tbody>{children}</tbody> : null}
    </table>
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
