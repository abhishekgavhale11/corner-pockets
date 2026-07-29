import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getCustomerById } from "@/actions/customers";
import { getCustomerFinancials } from "@/actions/customer-ledger";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";
import { isAdminRole, type StaffRole } from "@/lib/auth/roles";
import { isEligibleForOpeningOutstandingFromFinancials } from "@/lib/outstanding/opening-eligibility";

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

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  const isAdmin = role ? isAdminRole(role) : false;
  const canAddOpeningOutstanding =
    isAdmin &&
    isEligibleForOpeningOutstandingFromFinancials(summary, activityItems);

  return (
    <CustomerDetailView
      customer={customer}
      summary={summary}
      activityItems={activityItems}
      canAddOpeningOutstanding={canAddOpeningOutstanding}
    />
  );
}
