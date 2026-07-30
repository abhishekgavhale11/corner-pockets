import { signOut } from "@/lib/auth/config";
import { hasPermission, roleLabel, type StaffRole } from "@/lib/auth/roles";
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
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogoutIcon className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
