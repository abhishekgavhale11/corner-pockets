"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils/format";
import {
  formatLastPaymentLabel,
  formatLastVisitLabel,
} from "@/lib/utils/customer-ledger-display";
import {
  buildOutstandingBalanceMessage,
  whatsAppShareUrl,
} from "@/lib/utils/whatsapp-balance";
import type { CustomerOutstandingRowDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CollectPaymentTrigger } from "@/components/customers/CollectPaymentTrigger";
import { cn } from "@/lib/utils/cn";

interface OutstandingPageProps {
  rows: CustomerOutstandingRowDTO[];
  initialQuery?: string;
}

export function OutstandingPage({
  rows,
  initialQuery = "",
}: OutstandingPageProps) {
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
            {formatCurrency(totalOutstanding)} total owed
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
        <div className="border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No outstanding balances.
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((row) => {
            const whatsAppHref = whatsAppShareUrl(
              row.phoneNumber,
              buildOutstandingBalanceMessage(
                row.customerName,
                row.outstandingAmount
              )
            );

            return (
              <article
                key={row.customerId}
                className="border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900">
                      {row.customerName}
                    </h2>
                    <p
                      className={cn(
                        "mt-1 text-lg font-bold",
                        row.outstandingAmount > 0
                          ? "text-red-700"
                          : "text-gray-900"
                      )}
                    >
                      Outstanding: {formatCurrency(row.outstandingAmount)}
                    </p>
                    <dl className="mt-2 space-y-0.5 text-sm text-gray-600">
                      <div className="flex gap-2">
                        <dt>Last Visit:</dt>
                        <dd className="font-medium text-gray-900">
                          {formatLastVisitLabel(row.lastVisitAt)}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt>Last Payment:</dt>
                        <dd className="font-medium text-gray-900">
                          {formatLastPaymentLabel(
                            row.lastPaymentAmount,
                            row.lastPaymentAt
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CollectPaymentTrigger
                      customer={{
                        id: row.customerId,
                        name: row.customerName,
                        walletEnabled: row.walletEnabled,
                        cardId: row.cardId,
                        phone: row.phoneNumber,
                      }}
                      outstandingAmount={row.outstandingAmount}
                      hasActiveVisitWithDue={row.hasActiveVisitWithDue}
                      activeVisitDueAmount={row.activeVisitDueAmount}
                    />
                    <Link href={`/customers/${row.customerId}`}>
                      <Button size="sm" variant="secondary">
                        View Profile
                      </Button>
                    </Link>
                    <a
                      href={whatsAppHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="secondary">
                        WhatsApp
                      </Button>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
