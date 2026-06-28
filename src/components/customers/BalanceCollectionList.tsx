"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils/format";
import { formatLastVisitLabel } from "@/lib/utils/customer-ledger-display";
import {
  buildOutstandingBalanceMessage,
  whatsAppShareUrl,
} from "@/lib/utils/whatsapp-balance";
import { checkoutHrefForCustomer } from "@/lib/utils/checkout-navigation";
import type { CustomerOutstandingRowDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface BalanceCollectionListProps {
  rows: CustomerOutstandingRowDTO[];
  initialQuery?: string;
}

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
          <h1 className="text-xl font-bold text-gray-900">Outstanding Balances</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totalOutstanding)} total
          </p>
        </div>
        <form
          className="w-full max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or phone…"
            className="h-9 text-sm"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No outstanding balances.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Phone</th>
                <th className="px-4 py-2 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-2 font-semibold">Last Visit</th>
                <th className="px-4 py-2 font-semibold">Last Payment</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const phoneDigits = row.phoneNumber.replace(/\D/g, "");
                const callHref = phoneDigits ? `tel:${phoneDigits}` : undefined;
                const whatsAppHref = whatsAppShareUrl(
                  row.phoneNumber,
                  buildOutstandingBalanceMessage(
                    row.customerName,
                    row.outstandingAmount
                  )
                );

                return (
                  <tr
                    key={row.customerId}
                    className="border-b border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="font-semibold text-emerald-800 hover:underline"
                      >
                        {row.customerName}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {row.openBillsCount} open bill
                        {row.openBillsCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-gray-800">
                      {row.phoneNumber || "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-bold text-red-700">
                      {formatCurrency(row.outstandingAmount)}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-800">
                      {formatLastVisitLabel(row.lastVisitAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-gray-800">
                      {row.lastPaymentAt
                        ? formatLastVisitLabel(row.lastPaymentAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {callHref && (
                          <a href={callHref}>
                            <Button size="sm" variant="secondary">
                              Call
                            </Button>
                          </a>
                        )}
                        <a
                          href={whatsAppHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="secondary">
                            WhatsApp
                          </Button>
                        </a>
                        <Link href={checkoutHrefForCustomer(row.customerId)}>
                          <Button size="sm">Record Payment</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
