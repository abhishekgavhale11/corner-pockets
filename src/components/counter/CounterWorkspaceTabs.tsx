"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const TABS = [
  {
    href: "/counter/big-snooker",
    label: "Big Snooker",
    icon: "🎱",
    match: (p: string) =>
      p.startsWith("/counter/big-snooker") || p === "/counter",
  },
  {
    href: "/counter/pool-mini",
    label: "Pool & Mini",
    icon: "🎱",
    match: (p: string) =>
      p.startsWith("/counter/pool-mini") ||
      p.startsWith("/counter/pool") ||
      p.startsWith("/counter/mini"),
  },
  {
    href: "/counter/cafe",
    label: "Cafe",
    icon: "☕",
    match: (p: string) => p.startsWith("/counter/cafe"),
  },
] as const;

interface CounterWorkspaceTabsProps {
  /** Right-side actions on the same toolbar row (e.g. New Customer). */
  trailing?: ReactNode;
}

/**
 * Counter workspace toolbar — segmented navigation + optional trailing actions.
 * Links only; no business logic.
 */
export function CounterWorkspaceTabs({ trailing }: CounterWorkspaceTabsProps) {
  const pathname = usePathname();

  return (
    <div className="mb-2.5 flex h-[50px] items-center gap-3">
      <nav
        className="flex h-full min-w-0 items-center"
        aria-label="Counter workspace"
      >
        <div className="inline-flex h-[42px] items-stretch gap-1.5">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-full items-center gap-1.5 rounded-[11px] px-3.5 text-[13px] font-semibold tracking-tight transition-all duration-150",
                  active
                    ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/20"
                    : "border border-gray-200 bg-white text-gray-800 shadow-sm shadow-gray-900/5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                )}
              >
                <span className="text-[15px] leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {trailing != null && (
        <div className="ml-auto flex h-full shrink-0 items-center">{trailing}</div>
      )}
    </div>
  );
}
