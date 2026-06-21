import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getDashboardStats } from "@/actions/dashboard";
import { QuickActions, StatsCards } from "@/components/dashboard/StatsCards";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;

  if (!hasPermission(role, "DASHBOARD_VIEW")) {
    redirect("/customers");
  }

  const stats = await getDashboardStats();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-600">Today&apos;s wallet activity.</p>
      </div>

      <StatsCards stats={stats} />
      <QuickActions />
    </div>
  );
}
