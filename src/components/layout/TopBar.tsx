import { signOut } from "@/lib/auth/config";
import { hasPermission, roleLabel, type StaffRole } from "@/lib/auth/roles";
import { ClubLogo } from "@/components/layout/ClubLogo";
import { CloseBusinessDayControl } from "@/components/counter/CloseBusinessDayControl";

interface TopBarProps {
  staffName: string;
  staffRole: StaffRole;
}

export function TopBar({ staffName, staffRole }: TopBarProps) {
  const canCloseBusinessDay = hasPermission(staffRole, "BUSINESS_DAY_MANAGE");

  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between bg-white px-2 py-1.5">
      <div className="text-[11px] text-gray-500">
        <span className="font-medium text-gray-800">{staffName}</span>
        <span className="mx-1.5 text-gray-300">·</span>
        <span>{roleLabel(staffRole)}</span>
      </div>

      <div className="flex items-center gap-2">
        {canCloseBusinessDay ? <CloseBusinessDayControl /> : null}
        <div className="flex items-center gap-2 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700">
          <ClubLogo size={16} className="rounded-sm" />
          <span className="font-medium">Corner Pockets</span>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
