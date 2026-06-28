import Link from "next/link";
import { formatActivityTimeParts } from "@/lib/utils/activity-display";
import { formatLedgerAmount } from "@/lib/utils/customer-ledger-display";
import type { CustomerDTO, CustomerLedgerLineDTO } from "@/types";
import type { CustomerLedgerSummaryDTO } from "@/types";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";
import { cn } from "@/lib/utils/cn";

interface CustomerLedgerViewProps {
  customer: CustomerDTO;
  summary: CustomerLedgerSummaryDTO;
  lines: CustomerLedgerLineDTO[];
}

export function CustomerLedgerView({
  customer,
  summary,
  lines,
}: CustomerLedgerViewProps) {
  const base = `/customers/${customer.id}`;
  const chronological = [...lines].reverse();

  return (
    <div className="space-y-3">
      <Link
        href={base}
        className="inline-block text-xs font-medium text-emerald-800 hover:underline"
      >
        ← {customer.name}
      </Link>

      <CustomerSummaryCard customer={customer} summary={summary} />

      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-2.5">
          <h2 className="text-sm font-bold text-gray-900">Ledger</h2>
          <p className="text-xs text-gray-500">
            Complete financial history — newest first
          </p>
        </div>

        {chronological.length <= 1 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-2 font-semibold">Description</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2 font-semibold">Staff</th>
                </tr>
              </thead>
              <tbody>
                {chronological.map((line) => {
                  const { date, time } = formatActivityTimeParts(line.timestamp);
                  const isOpening = line.id === "opening";

                  return (
                    <tr
                      key={line.id}
                      className={cn(
                        "border-b border-gray-100",
                        isOpening && "bg-gray-50/80"
                      )}
                    >
                      <td className="px-4 py-2.5 align-top whitespace-nowrap">
                        <div className="font-medium text-gray-900">{date}</div>
                        <div className="text-xs text-gray-500">{time}</div>
                      </td>
                      <td className="px-4 py-2.5 align-top font-medium text-gray-900">
                        {line.description}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 align-top text-right font-semibold tabular-nums",
                          line.amount > 0 && "text-emerald-700",
                          line.amount < 0 && "text-red-700",
                          line.amount === 0 && "text-gray-500"
                        )}
                      >
                        {isOpening ? "—" : formatLedgerAmount(line.amount)}
                      </td>
                      <td className="px-4 py-2.5 align-top text-right text-xs font-medium text-gray-800">
                        {line.balanceLabel}
                      </td>
                      <td className="px-4 py-2.5 align-top text-xs text-gray-500">
                        {line.staffUsername}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
