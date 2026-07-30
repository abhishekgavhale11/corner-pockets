"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { ClubLogo } from "@/components/layout/ClubLogo";
import { cn } from "@/lib/utils/cn";

const navItems = [
  {
    href: "/counter/big-snooker",
    label: "Big Snooker",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "🎱",
    match: (path: string) =>
      path === "/counter" ||
      path === "/counter/big-snooker" ||
      path.startsWith("/counter/cafe") ||
      path === "/counter/pool-mini" ||
      path === "/counter/pool" ||
      path === "/counter/mini",
  },
  {
    href: "/business-day/history",
    label: "Business Day History",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "📅",
    match: (path: string) => path.startsWith("/business-day/history"),
  },
  {
    href: "/customers",
    label: "Customers",
    permission: "CUSTOMER_SEARCH" as const,
    icon: "👥",
    match: (path: string) =>
      path === "/customers" || path.startsWith("/customers/"),
  },
  {
    href: "/expenses",
    label: "Expenses",
    permission: "EXPENSE_VIEW" as const,
    icon: "💸",
    match: (path: string) => path.startsWith("/expenses"),
  },
  {
    href: "/admin",
    label: "Admin",
    permission: "STAFF_VIEW" as const,
    icon: "⚙️",
    match: (path: string) =>
      path.startsWith("/admin") || path.startsWith("/staff"),
  },
];

interface SidebarProps {
  role: StaffRole;
  onHide?: () => void;
}

export function Sidebar({ role, onHide }: SidebarProps) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => hasPermission(role, item.permission));

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col overflow-y-auto bg-emerald-950 text-white">
      <div className="sticky top-0 z-10 border-b border-emerald-900/50 bg-emerald-950 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <ClubLogo size={36} />
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
                Snooker Club
              </p>
              <p className="truncate text-base font-bold leading-snug tracking-tight">
                Corner Pockets
              </p>
            </div>
          </div>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-800/70 bg-emerald-900/50 text-emerald-100 shadow-sm transition-colors hover:border-emerald-700 hover:bg-emerald-800 hover:text-white"
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <HideIcon />
            </button>
          )}
        </div>
      </div>

      <nav className="px-3 py-4">
        {visible.map((item) => {
          const isActive = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mb-1.5 flex items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold tracking-tight transition-colors",
                isActive
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "text-emerald-50/90 hover:bg-emerald-900/80 hover:text-white"
              )}
            >
              <span
                className="inline-flex w-[22px] shrink-0 justify-center text-[18px] leading-none"
                aria-hidden
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function HideIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
      <path d="M9 6v12" />
    </svg>
  );
}
