import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getManageableStaff } from "@/actions/staff";
import { UsersManagement } from "@/components/users/UsersManagement";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;

  if (!session?.user?.id || !role || !hasPermission(role, "STAFF_VIEW")) {
    redirect("/customers");
  }

  const users = await getManageableStaff();

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
      >
        ← Admin
      </Link>
      <UsersManagement users={users} currentUserId={session.user.id} />
    </div>
  );
}
