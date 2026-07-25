import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers";
import { getCustomerFinancials } from "@/actions/customer-ledger";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";

export const dynamic = "force-dynamic";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const financials = await getCustomerFinancials(id);

  if (!financials) {
    notFound();
  }

  const { summary, activityItems } = financials;

  return (
    <CustomerDetailView
      customer={customer}
      summary={summary}
      activityItems={activityItems}
    />
  );
}
