import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { formatLastVisitLabel } from "@/lib/utils/customer-ledger-display";
import { cn } from "@/lib/utils/cn";
import type { CustomerListRowDTO } from "@/types";

interface CustomerListProps {
  customers: CustomerListRowDTO[];
  emptyMessage?: string;
}

function SortHint() {
  return (
    <span className="ml-1 inline-flex flex-col text-gray-300" aria-hidden>
      <svg viewBox="0 0 10 6" className="h-1.5 w-2.5">
        <path d="M5 0 10 6H0Z" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 10 6" className="-mt-0.5 h-1.5 w-2.5 rotate-180">
        <path d="M5 0 10 6H0Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function CustomerList({
  customers,
  emptyMessage = "No customers found.",
}: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
        <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-flex items-center">
                  Customer Name
                  <SortHint />
                </span>
              </th>
              <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-flex items-center">
                  Mobile Number
                  <SortHint />
                </span>
              </th>
              <th className="whitespace-nowrap px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-flex items-center justify-end">
                  Outstanding
                  <SortHint />
                </span>
              </th>
              <th className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-flex items-center">
                  Last Visit
                  <SortHint />
                </span>
              </th>
              <th className="w-10 px-3 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((customer) => {
              const phone = customer.phone?.trim() || "—";
              const hasOutstanding = customer.outstandingAmount > 0;
              const href = `/customers/${customer.id}`;

              return (
                <tr key={customer.id} className="group hover:bg-emerald-50/40">
                  <td className="px-4 py-1.5">
                    <Link
                      href={href}
                      className="text-[14px] font-semibold text-emerald-800 hover:text-emerald-950 hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    <Link
                      href={href}
                      className="font-mono text-[13px] tabular-nums text-gray-700"
                    >
                      {phone}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right">
                    <Link
                      href={href}
                      className={cn(
                        "text-[13px] font-bold tabular-nums",
                        hasOutstanding
                          ? "text-orange-600"
                          : "text-emerald-600"
                      )}
                    >
                      {formatCurrency(customer.outstandingAmount)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-1.5">
                    <Link href={href} className="text-[13px] text-gray-600">
                      {formatLastVisitLabel(customer.lastVisitAt)}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Link
                      href={href}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-300 transition-colors group-hover:bg-white group-hover:text-emerald-700 group-hover:shadow-sm"
                      aria-label={`Open ${customer.name}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
