import {
  CustomerCell,
  PaymentBadge,
  historyUi,
  historyToneText,
} from "@/components/business-day/history";
import {
  formatBusinessDayDate,
  formatBusinessDayTime,
} from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { OutstandingCollectionLedgerResultDTO } from "@/types";

interface OutstandingCollectionLedgerProps {
  ledger: OutstandingCollectionLedgerResultDTO;
}

export function OutstandingCollectionLedger({
  ledger,
}: OutstandingCollectionLedgerProps) {
  const { items, summary } = ledger;

  if (items.length === 0) {
    return (
      <div
        className={`${historyUi.card} px-4 py-3 text-center text-sm text-gray-500`}
      >
        No Outstanding collections in this date range.
      </div>
    );
  }

  return (
    <section className={`${historyUi.card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight text-gray-900">
            Outstanding Collections
          </h3>
        </div>
        <span
          className={`text-[13px] font-semibold tabular-nums ${historyToneText("positive")}`}
        >
          {formatCurrency(summary.totalOutstandingRecovered)}
        </span>
      </div>
      <div className="min-w-0 overflow-x-hidden">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/90">
              <th className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Customer
              </th>
              <th className="px-3 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Amount Paid
              </th>
              <th className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Payment Mode
              </th>
              <th className="hidden px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 md:table-cell">
                Date/Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((row) => (
              <tr
                key={row.id}
                className={`align-middle ${historyUi.rowHover}`}
              >
                <td className="min-w-0 px-3 py-1.5">
                  <CustomerCell
                    name={row.customerName}
                    href={`/customers/${row.customerId}`}
                    compact
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span
                    className={`whitespace-nowrap text-[15px] font-bold tabular-nums ${historyToneText("positive")}`}
                  >
                    {formatCurrency(row.amountCollected)}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <PaymentBadge method={row.paymentMethod} />
                </td>
                <td className="hidden px-3 py-1.5 md:table-cell">
                  <p className="whitespace-nowrap text-[13px] tabular-nums text-gray-800">
                    {formatBusinessDayDate(row.collectedAt)}
                    <span className="ml-1.5 text-gray-500">
                      {formatBusinessDayTime(row.collectedAt)}
                    </span>
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
