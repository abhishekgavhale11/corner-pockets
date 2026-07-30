/**
 * Time/Type/Customer/Amount/Due share the remaining width proportionally
 * (12:18:28:16:16, matching the recommended column ratios). Actions gets a
 * fixed minimum width instead of a percentage so the two icon buttons never
 * get crushed together at high browser zoom or narrow table widths.
 */
const ACTIONS_COL_WIDTH = "84px";

const COL_GROUP = (
  <colgroup>
    <col className="w-[12%]" />
    <col className="w-[18%]" />
    <col className="w-[28%]" />
    <col className="w-[16%]" />
    <col className="w-[16%]" />
    <col style={{ width: ACTIONS_COL_WIDTH }} />
  </colgroup>
);

const HEADER_ROW = (
  <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
    <th className="px-3 py-2.5 text-left font-semibold">Time</th>
    <th className="px-3 py-2.5 text-left font-semibold">Type</th>
    <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
    <th className="px-3 py-2.5 text-right font-semibold">Due</th>
    <th
      className="px-3 py-2.5 text-right font-semibold"
      style={{ minWidth: ACTIONS_COL_WIDTH }}
    >
      Actions
    </th>
  </tr>
);

interface CounterLedgerTableProps {
  children: React.ReactNode;
  /** Chrome above the body (section title, quick buttons, Add Frame, column headers). */
  stickyChrome?: React.ReactNode;
  className?: string;
}

/**
 * Counter frame ledger — scrolls naturally with the shared workspace scroll
 * container. Only the app shell (sidebar, top header, game tabs) is sticky;
 * nothing at the table level (chrome, column headers, footers) sticks, so
 * Table 1 / 2 / 3 always move together with no overlap.
 */
export function CounterLedgerTable({
  children,
  stickyChrome,
  className,
}: CounterLedgerTableProps) {
  return (
    <div className={className}>
      {stickyChrome != null && (
        <div className="rounded-t-xl bg-white">{stickyChrome}</div>
      )}
      <table className="w-full table-fixed border-collapse">
        {COL_GROUP}
        <thead className="border-b border-gray-100 bg-gray-50/90">
          {HEADER_ROW}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
