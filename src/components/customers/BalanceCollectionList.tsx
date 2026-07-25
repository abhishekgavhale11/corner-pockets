"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerOutstandingRowDTO } from "@/types";
import { Input } from "@/components/ui/Input";

interface BalanceCollectionListProps {
  rows: CustomerOutstandingRowDTO[];
  initialQuery?: string;
}

/** @deprecated Prefer OutstandingPage — identification list only. */
export function BalanceCollectionList({
  rows,
  initialQuery = "",
}: BalanceCollectionListProps) {
  const [query, setQuery] = useState(initialQuery);

  const filtered = rows.filter((row) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      row.customerName.toLowerCase().includes(q) ||
      row.phoneNumber.includes(q)
    );
  });

  const totalOutstanding = filtered.reduce(
    (sum, row) => sum + row.outstandingAmount,
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Outstanding</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totalOutstanding)} total
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

      {filtered.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No customers with Outstanding.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Mobile</th>
                <th className="px-4 py-2 text-right font-semibold">
                  Current Outstanding
                </th>
                <th className="px-4 py-2 text-right font-semibold">
                  Unpaid Business Days
                </th>
                <th className="px-4 py-2 font-semibold">
                  Oldest Outstanding Date
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.customerId} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-semibold text-gray-900 hover:text-emerald-800"
                    >
                      {row.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">
                    {row.phoneNumber}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-orange-700">
                    {formatCurrency(row.outstandingAmount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.unpaidBusinessDayCount}
                  </td>
                  <td className="px-4 py-3">
                    {formatBusinessDayDate(row.oldestOutstandingDate)}
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
