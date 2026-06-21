import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import type { CustomerDTO } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface CustomerListProps {
  customers: CustomerDTO[];
}

export function CustomerList({ customers }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-gray-600">No customers found.</p>
        <Link
          href="/customers/new"
          className="mt-4 inline-block font-medium text-emerald-800 hover:underline"
        >
          Register your first customer
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {customers.map((customer) => (
        <Link key={customer.id} href={`/customers/${customer.id}`}>
          <Card className="transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold text-gray-900">
                    {customer.name}
                  </p>
                  {customer.isStudent && (
                    <Badge variant="success">Student</Badge>
                  )}
                </div>
                <p className="truncate text-sm text-gray-500">
                  {customer.cardId} · {customer.phone}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-emerald-800">
                  {formatCurrency(customer.balance)}
                </p>
                <p className="text-xs text-gray-500">balance</p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
