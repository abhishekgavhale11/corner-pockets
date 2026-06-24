import { signOut } from "@/lib/auth/config";
import { roleLabel, type StaffRole } from "@/lib/auth/roles";

interface TopBarProps {
  staffName: string;
  staffRole: StaffRole;
}

export function TopBar({ staffName, staffRole }: TopBarProps) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-2">
      <div className="text-[11px] text-gray-500">
        <span className="font-medium text-gray-800">{staffName}</span>
        <span className="mx-1.5 text-gray-300">·</span>
        <span>{roleLabel(staffRole)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700">
          <span aria-hidden>🏢</span>
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
