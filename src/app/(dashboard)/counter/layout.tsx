import { connectDB } from "@/lib/db/connect";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { hasOpenBusinessDay } from "@/lib/business-day/queries";
import { StartBusinessDayScreen } from "@/components/counter/StartBusinessDayScreen";

/**
 * Counter gate: asks Business Day module only whether an OPEN day exists.
 * No close/reopen/validation rules live here.
 */
export default async function CounterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connectDB();
  const open = await hasOpenBusinessDay();

  if (!open) {
    const session = await auth();
    const role = session?.user?.role as StaffRole | undefined;
    const canManageBusinessDay = role
      ? hasPermission(role, "BUSINESS_DAY_MANAGE")
      : false;
    return (
      <StartBusinessDayScreen canManageBusinessDay={canManageBusinessDay} />
    );
  }

  return children;
}
