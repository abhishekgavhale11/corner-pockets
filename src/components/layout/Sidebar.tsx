"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";

const navItems = [
  {
    href: "/counter/big-snooker",
    label: "Big Snooker",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "🎱",
    match: (path: string) =>
      path === "/counter" || path === "/counter/big-snooker",
  },
  {
    href: "/counter/pool-mini",
    label: "Mini",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "🎱",
    match: (path: string) =>
      path === "/counter/pool-mini" ||
      path === "/counter/pool" ||
      path === "/counter/mini",
  },
  {
    href: "/counter/cafe",
    label: "Cafe",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "☕",
    match: (path: string) => path.startsWith("/counter/cafe"),
  },
  {
    href: "/checkout",
    label: "Checkout",
    permission: "NOTEBOOK_VIEW" as const,
    icon: "💰",
    match: (path: string) => path.startsWith("/checkout"),
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
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => hasPermission(role, item.permission));

  return (
    <aside className="flex w-[272px] shrink-0 flex-col bg-emerald-950 text-white">
      <div className="border-b border-emerald-900/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[26px] leading-none" aria-hidden>
            🎱
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-400/90">
              Snooker Club
            </p>
            <p className="truncate text-base font-bold leading-snug tracking-tight">
              Corner Pockets
            </p>
          </div>
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
