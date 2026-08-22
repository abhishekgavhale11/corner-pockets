import { signOut } from "@/lib/auth/config";
import { hasPermission, roleLabel, type StaffRole } from "@/lib/auth/roles";
import { CloseBusinessDayControl } from "@/components/counter/CloseBusinessDayControl";
import { Button } from "@/components/ui/Button";

interface TopBarProps {
  staffName: string;
  staffRole: StaffRole;
}

export function TopBar({ staffName, staffRole }: TopBarProps) {
  const canCloseBusinessDay = hasPermission(staffRole, "BUSINESS_DAY_MANAGE");

  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between bg-white px-3 py-2">
      <div className="min-w-0 text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{staffName}</span>
        <span className="mx-2 text-gray-300">·</span>
        <span className="text-gray-500">{roleLabel(staffRole)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {canCloseBusinessDay ? <CloseBusinessDayControl /> : null}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button
            type="submit"
            variant="secondary"
            size="md"
            className="gap-2 border-red-300 bg-red-50 font-semibold text-red-700 shadow-sm hover:border-red-400 hover:bg-red-100 hover:text-red-800 focus-visible:ring-red-400"
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
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
