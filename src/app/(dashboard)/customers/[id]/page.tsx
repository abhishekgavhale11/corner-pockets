import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getCustomerById } from "@/actions/customers";
import {
  getCustomerFinancials,
} from "@/actions/customer-ledger";
import { CustomerDetailView } from "@/components/customers/CustomerDetailView";

export const dynamic = "force-dynamic";

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

  const openRecharge = sp.recharge === "1";
  const financials = await getCustomerFinancials(id);

  if (!financials) {
    notFound();
  }

  const { summary, ledgerLines } = financials;

  const canEditDetails = hasPermission(role, "CUSTOMER_EDIT_DETAILS");
  const canReverseRecharges = hasPermission(role, "TRANSACTION_REVERSE");
  const currentUsername = session?.user?.username ?? undefined;

  return (
    <CustomerDetailView
      customer={customer}
      summary={summary}
      ledgerLines={ledgerLines}
      canEditDetails={canEditDetails}
      canReverseRecharges={canReverseRecharges}
      initialRechargeOpen={openRecharge}
      currentUsername={currentUsername}
    />
  );
}
