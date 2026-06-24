"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { formatCustomerContactLine } from "@/lib/utils/customer-display";
import type { OpenTabSummaryDTO } from "@/types";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";

interface OpenTabsListProps {
  tabs: OpenTabSummaryDTO[];
  initialQuery?: string;
}

export function OpenTabsList({ tabs, initialQuery = "" }: OpenTabsListProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.replace(
      params.toString() ? `/notebook/tabs?${params}` : "/notebook/tabs"
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, or card ID"
        />
      </form>

      {tabs.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">No open tabs right now.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tabs.map((tab) => (
            <li key={tab.tabKey}>
              {tab.kind === "customer" ? (
                <Link href={`/notebook/tabs/${tab.customerId}`}>
                  <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-emerald-600 hover:bg-emerald-50">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {tab.customerName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatCustomerContactLine({
                          walletEnabled: tab.walletEnabled,
                          cardId: tab.cardId,
                          phone: tab.phoneNumber,
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tab.pendingCount} pending entr
                        {tab.pendingCount === 1 ? "y" : "ies"}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-emerald-800">
                      {formatCurrency(tab.pendingAmount)}
                    </p>
                  </Card>
                </Link>
              ) : (
                <Link href="/checkout">
                  <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-emerald-600 hover:bg-emerald-50">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {tab.tableName}
                      </p>
                      <p className="text-sm text-gray-600">Unassigned table</p>
                      <p className="text-xs text-gray-500">
                        {tab.pendingCount} pending entr
                        {tab.pendingCount === 1 ? "y" : "ies"}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-emerald-800">
                      {formatCurrency(tab.pendingAmount)}
                    </p>
                  </Card>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
