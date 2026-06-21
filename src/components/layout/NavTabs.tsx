"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  hasPermission,
  type StaffRole,
} from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";

const allLinks = [
  { href: "/dashboard", label: "Dashboard", permission: "DASHBOARD_VIEW" as const },
  { href: "/customers", label: "Customers", permission: "CUSTOMER_SEARCH" as const },
  {
    href: "/customers/new",
    label: "Register",
    permission: "CUSTOMER_REGISTER" as const,
  },
  { href: "/staff", label: "Staff", permission: "STAFF_VIEW" as const },
];

interface NavTabsProps {
  role: StaffRole;
}

export function NavTabs({ role }: NavTabsProps) {
  const pathname = usePathname();
  const links = allLinks.filter((link) => hasPermission(role, link.permission));

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
        {links.map((link) => {
          const isActive =
            link.href === "/customers"
              ? pathname === "/customers" ||
                (pathname.startsWith("/customers/") &&
                  pathname !== "/customers/new")
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] flex items-center",
                isActive
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
