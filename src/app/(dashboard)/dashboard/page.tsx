import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import type { StaffRole } from "@/lib/auth/roles";
import { getDefaultHomePath } from "@/lib/auth/roles";

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;
  redirect(getDefaultHomePath(role));
}
