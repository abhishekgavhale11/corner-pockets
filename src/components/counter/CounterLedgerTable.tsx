/**
 * Counter frame ledger column layout.
 *
 * Big Snooker (with Type): Time / Type / Customer / Amount / Due / Actions
 * Pool & Mini (no Type):   Time / Customer / Amount / Due / Actions
 *
 * Actions gets a fixed minimum width so the two icon buttons never get
 * crushed together at high browser zoom or narrow table widths.
 */
const ACTIONS_COL_WIDTH = "84px";

const COL_GROUP_WITH_TYPE = (
  <colgroup>
    <col className="w-[12%]" />
    <col className="w-[18%]" />
    <col className="w-[28%]" />
    <col className="w-[16%]" />
    <col className="w-[16%]" />
    <col style={{ width: ACTIONS_COL_WIDTH }} />
  </colgroup>
);

/** Customer takes remaining space; Amount / Due / Actions stay stable. */
const COL_GROUP_WITHOUT_TYPE = (
  <colgroup>
    <col className="w-[14%]" />
    <col />
    <col className="w-[18%]" />
    <col className="w-[14%]" />
    <col style={{ width: ACTIONS_COL_WIDTH, minWidth: ACTIONS_COL_WIDTH }} />
  </colgroup>
);

function HeaderRow({ showTypeColumn }: { showTypeColumn: boolean }) {
  return (
    <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
      <th className="px-3 py-2.5 text-left font-semibold">Time</th>
      {showTypeColumn ? (
        <th className="px-3 py-2.5 text-left font-semibold">Type</th>
      ) : null}
      <th className="min-w-0 px-3 py-2.5 text-left font-semibold">Customer</th>
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
}

interface CounterLedgerTableProps {
  children: React.ReactNode;
  /** Chrome above the body (section title, quick buttons, Add Frame, column headers). */
  stickyChrome?: React.ReactNode;
  className?: string;
  /**
   * Pool & Mini: hide Type — the card header already identifies the table.
   * Big Snooker keeps Type (default true).
   */
  showTypeColumn?: boolean;
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
  showTypeColumn = true,
}: CounterLedgerTableProps) {
  return (
    <div className={className}>
      {stickyChrome != null && (
        <div className="rounded-t-xl bg-white">{stickyChrome}</div>
      )}
      <table className="w-full table-fixed border-collapse">
        {showTypeColumn ? COL_GROUP_WITH_TYPE : COL_GROUP_WITHOUT_TYPE}
        <thead className="border-b border-gray-100 bg-gray-50/90">
          <HeaderRow showTypeColumn={showTypeColumn} />
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function counterLedgerColSpan(showTypeColumn: boolean): number {
  return showTypeColumn ? 6 : 5;
}
