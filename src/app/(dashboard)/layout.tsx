import { auth } from "@/lib/auth/config";
import type { StaffRole } from "@/lib/auth/roles";
import { Header } from "@/components/layout/Header";
import { NavTabs } from "@/components/layout/NavTabs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        staffName={session?.user?.name ?? "Staff"}
        staffRole={role}
      />
      <NavTabs role={role} />      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
