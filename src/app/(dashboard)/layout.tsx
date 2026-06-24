import { auth } from "@/lib/auth/config";
import type { StaffRole } from "@/lib/auth/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          staffName={session?.user?.name ?? "Staff"}
          staffRole={role}
        />
        <main className="flex-1 overflow-auto p-1.5 sm:p-2">{children}</main>
      </div>
    </div>
  );
}
