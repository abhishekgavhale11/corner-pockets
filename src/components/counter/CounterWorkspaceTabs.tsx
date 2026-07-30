"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { useCounterShellSlot } from "@/components/layout/CounterShellSlot";

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
 *
 * Rendered via portal into a slot that lives in the fixed app shell (right
 * below the top header, above the scrollable workspace). This makes it a
 * genuine part of the fixed shell — flush against the header with no gap,
 * no sticky-positioning math, and no risk of scrolling content bleeding
 * through — rather than a sticky element inside the scrollable area.
 */
export function CounterWorkspaceTabs({ trailing }: CounterWorkspaceTabsProps) {
  const pathname = usePathname();
  const slot = useCounterShellSlot();

  const content = (
    <div
      className={cn(
        "border-b border-gray-200 bg-gray-50 px-1.5 py-2 sm:px-2",
        "shadow-[0_2px_4px_-2px_rgba(15,23,42,0.08)]"
      )}
    >
      <div className="flex h-[52px] items-center gap-3">
        <nav
          className="flex h-full min-w-0 items-center"
          aria-label="Counter workspace"
        >
          <div className="inline-flex h-[52px] items-stretch gap-2">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-full items-center gap-2 rounded-[14px] px-6 text-[15px] font-semibold tracking-tight transition-all duration-150",
                    active
                      ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/20"
                      : "border border-gray-200 bg-white text-gray-800 shadow-sm shadow-gray-900/5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                  )}
                >
                  <span className="text-[18px] leading-none" aria-hidden>
                    {tab.icon}
                  </span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {trailing != null && (
          <div className="ml-auto flex h-full shrink-0 items-center">
            {trailing}
          </div>
        )}
      </div>
    </div>
  );

  if (!slot) return null;
  return createPortal(content, slot);
}
