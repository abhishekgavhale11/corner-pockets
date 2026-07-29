import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { DataIntegrityView } from "@/components/admin/DataIntegrityView";

export default async function DataIntegrityPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;

  if (!session?.user?.id || !role || !hasPermission(role, "STAFF_VIEW")) {
    redirect("/customers");
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
      >
        ← Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Data Integrity
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Verify that stored Outstanding balances are internally consistent.
        </p>
      </div>

      <DataIntegrityView />
    </div>
  );
}
