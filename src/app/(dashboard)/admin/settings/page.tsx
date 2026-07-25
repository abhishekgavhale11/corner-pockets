import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";

export default async function AdminSettingsPage() {
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
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Club configuration for CPOS login and access.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/settings/users"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
        >
          <p className="text-base font-semibold text-gray-900">Users</p>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage login accounts (Admin / Staff).
          </p>
        </Link>
      </div>
    </div>
  );
}
