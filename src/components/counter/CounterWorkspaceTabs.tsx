"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  {
    href: "/counter/big-snooker",
    label: "Big Snooker",
    match: (p: string) =>
      p.startsWith("/counter/big-snooker") || p === "/counter",
  },
  {
    href: "/counter/pool-mini",
    label: "Pool & Mini",
    match: (p: string) =>
      p.startsWith("/counter/pool-mini") ||
      p.startsWith("/counter/pool") ||
      p.startsWith("/counter/mini"),
  },
  {
    href: "/counter/cafe",
    label: "Cafe",
    match: (p: string) => p.startsWith("/counter/cafe"),
  },
] as const;

export function CounterWorkspaceTabs() {
  const pathname = usePathname();

  return (
    <div
      className="mb-3 border-b border-gray-200"
      role="tablist"
      aria-label="Counter workspace"
    >
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={cn(
                "border-b-2 px-3 pb-2 text-sm font-semibold transition-colors",
                active
                  ? "border-emerald-800 text-emerald-900"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
