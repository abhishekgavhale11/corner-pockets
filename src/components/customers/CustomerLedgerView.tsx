import Link from "next/link";
import { formatActivityTimeParts } from "@/lib/utils/activity-display";
import {
  formatLedgerAmountForKind,
  ledgerEventKindLabel,
  ledgerLineAmountClass,
  ledgerLineDescriptionClass,
  ledgerLineRowClass,
  ledgerOutstandingClass,
} from "@/lib/utils/customer-ledger-display";
import type { CustomerDTO, CustomerLedgerLineDTO } from "@/types";
import type { CustomerLedgerSummaryDTO } from "@/types";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

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
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Charge
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Payment
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Status
            </span>
          </div>
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
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide">
                    Outstanding
                  </th>
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
                        isOpening && "bg-gray-50/80",
                        !isOpening && ledgerLineRowClass(line.kind)
                      )}
                    >
                      <td className="px-4 py-2.5 align-top whitespace-nowrap">
                        <div className="font-medium text-gray-900">{date}</div>
                        <div className="text-xs text-gray-500">{time}</div>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              line.kind === "charge" && "bg-red-500",
                              line.kind === "payment" && "bg-emerald-500",
                              line.kind === "status" && "bg-amber-500"
                            )}
                          />
                          <span
                            className={cn(
                              ledgerLineDescriptionClass(line.kind)
                            )}
                          >
                            {line.description}
                          </span>
                          {!isOpening ? (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                line.kind === "charge" && "bg-red-50 text-red-700",
                                line.kind === "payment" &&
                                  "bg-emerald-50 text-emerald-700",
                                line.kind === "status" &&
                                  "bg-amber-50 text-amber-800"
                              )}
                            >
                              {ledgerEventKindLabel(line.kind)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 align-top text-right text-xs font-bold tabular-nums",
                          isOpening
                            ? "text-gray-500"
                            : ledgerLineAmountClass(line.kind, line.amount)
                        )}
                      >
                        {isOpening
                          ? "—"
                          : formatLedgerAmountForKind(line.kind, line.amount)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 align-top text-right text-xs font-bold tabular-nums",
                          ledgerOutstandingClass(line.outstandingBalance)
                        )}
                      >
                        {formatCurrency(line.outstandingBalance)}
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
