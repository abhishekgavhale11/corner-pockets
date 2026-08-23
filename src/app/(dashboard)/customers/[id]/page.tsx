import { notFound } from "next/navigation";
import { getCustomerById } from "@/actions/customers";
import { getCustomerFinancials } from "@/actions/customer-ledger";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";
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

  const canAddOpeningOutstanding = isEligibleForOpeningOutstandingFromFinancials(
    summary,
    activityItems
  );

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  const canEditDetails = role
    ? hasPermission(role, "CUSTOMER_EDIT_DETAILS")
    : false;

  return (
    <CustomerDetailView
      customer={customer}
      summary={summary}
      activityItems={activityItems}
      canAddOpeningOutstanding={canAddOpeningOutstanding}
      canEditDetails={canEditDetails}
    />
  );
}
