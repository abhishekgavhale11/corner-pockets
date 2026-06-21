import Link from "next/link";
import { signOut } from "@/lib/auth/config";
import { getDefaultHomePath, roleLabel, type StaffRole } from "@/lib/auth/roles";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  staffName: string;
  staffRole: StaffRole;
}

export function Header({ staffName, staffRole }: HeaderProps) {
  const homePath = getDefaultHomePath(staffRole);

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/20 bg-emerald-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div>
          <Link href={homePath} className="block">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-200">
              Snooker Club
            </p>
            <h1 className="text-lg font-bold sm:text-xl">Corner Pockets</h1>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm text-emerald-100">{staffName}</p>
            <p className="text-xs text-emerald-200/80">{roleLabel(staffRole)}</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
