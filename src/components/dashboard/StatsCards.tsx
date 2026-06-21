import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { DashboardStats } from "@/types";
import { Card } from "@/components/ui/Card";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const items = [
    {
      label: "Today's Wallet Recharges",
      value: formatCurrency(stats.todayRecharges),
    },
    {
      label: "Today's Deductions",
      value: formatCurrency(stats.todayDeductions),
    },
    {
      label: "Today's Transactions",
      value: stats.todayTransactionCount.toString(),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <p className="text-sm text-gray-500">{item.label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}

export function QuickActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href="/customers/new"
        className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-emerald-800 px-4 py-3 text-center font-medium text-white hover:bg-emerald-900"
      >
        Register Customer
      </Link>
      <Link
        href="/customers"
        className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-medium text-gray-900 hover:bg-gray-50"
      >
        Search Customers
      </Link>
    </div>
  );
}
