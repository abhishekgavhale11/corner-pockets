import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers";
import { getCustomerTabEntries } from "@/actions/notebook-entries";
import { TabDetail } from "@/components/notebook/TabDetail";

interface TabDetailPageProps {
  params: Promise<{ customerId: string }>;
}

export default async function TabDetailPage({ params }: TabDetailPageProps) {
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
        href="/notebook/tabs"
        className="text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Open Tabs
      </Link>
      <TabDetail customer={customer} entries={entries} />
    </div>
  );
}
