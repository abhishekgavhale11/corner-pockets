"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
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

/** Hide the scrollbar visually while keeping native touch/wheel scroll intact. */
const SCROLLBAR_HIDDEN =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Counter workspace toolbar — segmented navigation + optional trailing actions.
 * Links only; no business logic.
 *
 * Rendered via portal into a slot that lives in the fixed app shell (right
 * below the top header, above the scrollable workspace). This makes it a
 * genuine part of the fixed shell — flush against the header with no gap,
 * no sticky-positioning math, and no risk of scrolling content bleeding
 * through — rather than a sticky element inside the scrollable area.
 *
 * Desktop (md+): unchanged single-row toolbar (tabs left, actions right).
 * Mobile/tablet (<768px): tabs move into their own horizontally scrollable
 * row (scrollbar hidden, active tab kept in view); actions wrap onto a
 * second row underneath so nothing gets clipped or fights for space.
 */
export function CounterWorkspaceTabs({ trailing }: CounterWorkspaceTabsProps) {
  const pathname = usePathname();
  const slot = useCounterShellSlot();
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
    });
  }, [pathname]);

  const content = (
    <div
      className={cn(
        "border-b border-gray-200 bg-gray-50 px-1.5 py-2 sm:px-2",
        "shadow-[0_2px_4px_-2px_rgba(15,23,42,0.08)]"
      )}
    >
      <div className="flex flex-col gap-2 md:h-[52px] md:flex-row md:items-center md:gap-3">
        <nav
          className={cn(
            "flex h-[52px] min-w-0 items-center gap-3 overflow-x-auto overscroll-x-contain",
            "md:h-full md:gap-2 md:overflow-visible",
            SCROLLBAR_HIDDEN
          )}
          aria-label="Counter workspace"
        >
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                ref={active ? activeTabRef : undefined}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-[52px] shrink-0 items-center gap-2 rounded-[14px] px-6 text-[15px] font-semibold tracking-tight transition-all duration-150",
                  "md:h-full",
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
        </nav>

        {trailing != null && (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto md:h-full md:shrink-0 md:flex-nowrap">
            {trailing}
          </div>
        )}
      </div>
    </div>
  );

  if (!slot) return null;
  return createPortal(content, slot);
}
