"use client";

import Link from "next/link";
import type { CustomerDTO, CustomerLedgerSummaryDTO } from "@/types";
import type { CustomerActivityItemDTO } from "@/types";
import { CustomerActivityTimeline } from "@/components/customers/CustomerActivityTimeline";
import { CustomerSummaryCard } from "@/components/customers/CustomerSummaryCard";

interface CustomerDetailViewProps {
  customer: CustomerDTO;
  summary: CustomerLedgerSummaryDTO;
  activityItems: CustomerActivityItemDTO[];
}

export function CustomerDetailView({
  customer,
  summary,
  activityItems,
}: CustomerDetailViewProps) {
  return (
    <div>
      <Link
        href="/customers"
        className="mb-2 inline-block text-xs font-medium text-emerald-800 hover:underline"
      >
        ← Customers
      </Link>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,32%)_minmax(0,68%)]">
        <CustomerSummaryCard customer={customer} summary={summary} />

        <CustomerActivityTimeline items={activityItems} />
      </div>
    </div>
  );
}
