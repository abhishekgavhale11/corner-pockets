import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";

/** Settings only contained Users — send Admins straight there. */
export default async function AdminSettingsPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;

  if (!session?.user?.id || !role || !hasPermission(role, "STAFF_VIEW")) {
    redirect("/customers");
  }

  redirect("/admin/settings/users");
}
