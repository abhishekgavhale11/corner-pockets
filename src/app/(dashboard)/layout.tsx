import { auth } from "@/lib/auth/config";
import type { StaffRole } from "@/lib/auth/roles";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TopBar } from "@/components/layout/TopBar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;

  return (
    <DashboardShell
      role={role}
      topBar={
        <TopBar
          staffName={session?.user?.name ?? "Staff"}
          staffRole={role}
        />
      }
    >
      {children}
    </DashboardShell>
  );
}
