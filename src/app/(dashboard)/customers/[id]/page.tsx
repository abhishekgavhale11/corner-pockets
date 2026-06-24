import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getCustomerById } from "@/actions/customers";
import { getCustomerActivity } from "@/actions/customer-activity";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const activityFilter =
    typeof sp.activity === "string" ? sp.activity : "all";
  const activity = await getCustomerActivity(id, activityFilter);

  const canEditDetails = hasPermission(role, "CUSTOMER_EDIT_DETAILS");
  const canReverseSettlements = hasPermission(role, "NOTEBOOK_SETTLEMENT_REVERSE");

  return (
    <CustomerDetailView
      customer={customer}
      activity={activity}
      canEditDetails={canEditDetails}
      canReverseSettlements={canReverseSettlements}
    />
  );
}
