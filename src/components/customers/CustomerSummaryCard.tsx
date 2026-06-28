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
import { checkoutHrefForCustomer } from "@/lib/utils/checkout-navigation";
import type { CustomerDTO } from "@/types";
import type { CustomerLedgerSummaryDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { CollectPaymentDialog } from "@/components/customers/CollectPaymentDialog";
import { cn } from "@/lib/utils/cn";

interface CustomerSummaryCardProps {
  customer: CustomerDTO;
  summary: CustomerLedgerSummaryDTO;
}

export function CustomerSummaryCard({
  customer,
  summary,
}: CustomerSummaryCardProps) {
  const [collectOpen, setCollectOpen] = useState(false);

  const whatsAppUrl =
    summary.outstandingAmount > 0
      ? whatsAppShareUrl(
          customer.phone,
          buildOutstandingBalanceMessage(
            customer.name,
            summary.outstandingAmount
          )
        )
      : null;

  return (
    <>
      <div className="border border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">{customer.name}</h1>

        <dl className="mt-3 space-y-2 text-sm">
          {customer.walletEnabled && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-gray-600">Wallet Balance</dt>
              <dd className="text-base font-bold text-emerald-800">
                {formatCurrency(summary.walletBalance)}
              </dd>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-600">Outstanding</dt>
            <dd
              className={cn(
                "text-base font-bold",
                summary.outstandingAmount > 0
                  ? "text-red-700"
                  : "text-gray-900"
              )}
            >
              {summary.outstandingAmount > 0
                ? formatCurrency(summary.outstandingAmount)
                : "₹0"}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-600">Open Bills</dt>
            <dd className="font-semibold text-gray-900">
              {summary.openBillsCount}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-600">Visits</dt>
            <dd className="font-semibold text-gray-900">{summary.visitCount}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-600">Last Visit</dt>
            <dd className="font-medium text-gray-900">
              {formatLastVisitLabel(summary.lastVisitAt)}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-600">Last Payment</dt>
            <dd className="font-medium text-gray-900">
              {formatLastPaymentLabel(
                summary.lastPaymentAmount,
                summary.lastPaymentAt
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {summary.outstandingAmount > 0 && (
            <Button size="sm" onClick={() => setCollectOpen(true)}>
              Collect Payment
            </Button>
          )}
          <Link href={checkoutHrefForCustomer(customer.id)}>
            <Button size="sm" variant="secondary">
              Open Checkout
            </Button>
          </Link>
          {whatsAppUrl && (
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="secondary">
                Share on WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>

      <CollectPaymentDialog
        customer={customer}
        outstandingAmount={summary.outstandingAmount}
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
      />
    </>
  );
}
