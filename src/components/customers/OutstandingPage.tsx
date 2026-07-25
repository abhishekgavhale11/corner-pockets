"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerOutstandingRowDTO } from "@/types";
import { Input } from "@/components/ui/Input";

interface OutstandingPageProps {
  rows: CustomerOutstandingRowDTO[];
  initialQuery?: string;
}

/**
 * Outstanding identification page only.
 * Collection always happens on the Customer page.
 */
export function OutstandingPage({
  rows,
  initialQuery = "",
}: OutstandingPageProps) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.customerName.toLowerCase().includes(q) ||
        row.phoneNumber.includes(q)
    );
  }, [rows, query]);

  const totalOutstanding = filtered.reduce(
    (sum, row) => sum + row.outstandingAmount,
    0
  );

  const oldestAcrossClub =
    filtered.length === 0
      ? null
      : filtered.reduce((oldest, row) =>
          row.oldestOutstandingDate < oldest
            ? row.oldestOutstandingDate
            : oldest,
          filtered[0].oldestOutstandingDate
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Outstanding</h1>
          <p className="text-sm text-gray-500">
            Customers who currently owe the club money
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or phone…"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total Outstanding
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-orange-700">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
        <div className="border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Customers with Outstanding
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
            {filtered.length}
          </p>
        </div>
        <div className="border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Oldest Outstanding Date
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">
            {oldestAcrossClub
              ? formatBusinessDayDate(oldestAcrossClub)
              : "—"}
          </p>
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No customers with Outstanding.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Mobile</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Current Outstanding
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Unpaid Business Days
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  Oldest Outstanding Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr key={row.customerId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-semibold text-gray-900 hover:text-emerald-800"
                    >
                      {row.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="hover:text-emerald-800"
                    >
                      {row.phoneNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-bold tabular-nums text-orange-700 hover:text-emerald-800"
                    >
                      {formatCurrency(row.outstandingAmount)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    <Link href={`/customers/${row.customerId}`}>
                      {row.unpaidBusinessDayCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <Link href={`/customers/${row.customerId}`}>
                      {formatBusinessDayDate(row.oldestOutstandingDate)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
