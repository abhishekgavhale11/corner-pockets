"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const SNOOKER_TABS = [
  { href: "/notebook/snooker", label: "Big Snooker" },
  { href: "/notebook/snooker/pool-mini", label: "Pool & Mini" },
] as const;

export function SnookerSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 border-b border-gray-200 pb-3">
      {SNOOKER_TABS.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-emerald-800 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
