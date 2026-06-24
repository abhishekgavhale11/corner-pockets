import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers";
import { getCustomerTabEntries } from "@/actions/notebook-entries";
import { SettlementForm } from "@/components/notebook/SettlementForm";

interface SettlePageProps {
  params: Promise<{ customerId: string }>;
}

export default async function SettlePage({ params }: SettlePageProps) {
  const { customerId } = await params;
  const [customer, entries] = await Promise.all([
    getCustomerById(customerId),
    getCustomerTabEntries(customerId),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href={`/notebook/tabs/${customerId}`}
        className="text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Back to tab
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settle Payment</h1>
        <p className="mt-1 text-gray-600">{customer.name}</p>
      </div>
      <SettlementForm entries={entries} defaultPayer={customer} />
    </div>
  );
}
