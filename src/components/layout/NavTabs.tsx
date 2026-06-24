"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";

const links = [
  { href: "/notebook", label: "Notebook", permission: "NOTEBOOK_VIEW" as const },
  {
    href: "/customers",
    label: "Customers",
    permission: "CUSTOMER_SEARCH" as const,
  },
  { href: "/admin", label: "Admin", permission: "STAFF_VIEW" as const },
];

interface NavTabsProps {
  role: StaffRole;
}

export function NavTabs({ role }: NavTabsProps) {
  const pathname = usePathname();
  const visible = links.filter((link) => hasPermission(role, link.permission));

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-0 overflow-x-auto px-3 sm:px-4">
        {visible.map((link) => {
          const isActive =
            link.href === "/customers"
              ? pathname === "/customers" ||
                (pathname.startsWith("/customers/") &&
                  !pathname.startsWith("/customers/new"))
              : link.href === "/admin"
                ? pathname.startsWith("/admin") ||
                  pathname.startsWith("/staff")
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors min-h-[36px] flex items-center",
                isActive
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-gray-600 hover:text-gray-900"
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
