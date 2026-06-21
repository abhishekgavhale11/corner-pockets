import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getCustomerById } from "@/actions/customers";
import { CustomerInfo } from "@/components/customers/CustomerInfo";
import { CustomerDetailHistory } from "@/components/customers/CustomerDetailHistory";
import { CustomerActions } from "@/components/customers/CustomerActions";
import { StudentStatusManager } from "@/components/customers/StudentStatusManager";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const canEditDetails = hasPermission(role, "CUSTOMER_EDIT_DETAILS");
  const canManageStudentStatus = hasPermission(role, "CUSTOMER_STUDENT_STATUS");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customers"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          ← Back to customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {customer.name}
        </h1>
      </div>

      <CustomerInfo customer={customer} canEditDetails={canEditDetails} />
      {canEditDetails && (
        <CustomerDetailHistory detailChanges={customer.detailChanges} />
      )}
      {canManageStudentStatus && (
        <StudentStatusManager customer={customer} />
      )}
      <CustomerActions customerId={customer.id} />
    </div>
  );
}