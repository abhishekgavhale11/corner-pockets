import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getManageableStaff } from "@/actions/staff";
import { StaffManagement } from "@/components/staff/StaffManagement";

export default async function StaffPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;

  if (!session?.user?.id || !role || !hasPermission(role, "STAFF_VIEW")) {
    redirect("/customers");
  }

  const staffAccounts = await getManageableStaff();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <p className="mt-1 text-gray-600">
          {role === "SUPER_MASTER"
            ? "Manage all staff accounts, roles, and access."
            : "Manage staff accounts and passwords."}
        </p>
      </div>

      <StaffManagement
        staffAccounts={staffAccounts}
        currentUserId={session.user.id}
        currentUserRole={role}
      />
    </div>
  );
}
