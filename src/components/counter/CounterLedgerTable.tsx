const COL_GROUP = (
  <colgroup>
    <col className="w-[12%]" />
    <col className="w-[16%]" />
    <col className="w-[28%]" />
    <col className="w-[16%]" />
    <col className="w-[16%]" />
    <col className="w-[12%]" />
  </colgroup>
);

const HEADER_ROW = (
  <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
    <th className="py-2 pl-3 pr-1 text-left font-semibold">Time</th>
    <th className="px-1.5 py-2 text-left font-semibold">Type</th>
    <th className="px-2 py-2 text-left font-semibold">Customer</th>
    <th className="px-1.5 py-2 text-right font-semibold">Amount</th>
    <th className="px-1.5 py-2 text-right font-semibold">Due</th>
    <th className="py-2 pl-1 pr-3 text-right font-semibold">Edit</th>
  </tr>
);

interface CounterLedgerTableProps {
  children: React.ReactNode;
  /** Sticky chrome above the body (section title, Add Frame, column headers). */
  stickyChrome?: React.ReactNode;
  className?: string;
}

/**
 * Counter frame ledger — natural height, page scroll only.
 * Column labels live in stickyChrome so header + Add Frame stick together.
 */
export function CounterLedgerTable({
  children,
  stickyChrome,
  className,
}: CounterLedgerTableProps) {
  return (
    <div className={className}>
      {stickyChrome != null && (
        <div className="sticky top-0 z-20 rounded-t-xl bg-white">
          {stickyChrome}
          <table
            aria-hidden
            className="w-full table-fixed border-collapse"
          >
            {COL_GROUP}
            <thead className="border-b border-gray-100 bg-gray-50/90">
              {HEADER_ROW}
            </thead>
          </table>
        </div>
      )}
      <table className="w-full table-fixed border-collapse">
        {COL_GROUP}
        {stickyChrome == null && (
          <thead className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/90">
            {HEADER_ROW}
          </thead>
        )}
        {stickyChrome != null && (
          <thead className="sr-only">{HEADER_ROW}</thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
