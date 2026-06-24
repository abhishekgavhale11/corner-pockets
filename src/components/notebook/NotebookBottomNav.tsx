"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/notebook/snooker", label: "Snooker", emoji: "🎱" },
  { href: "/notebook/cafe", label: "Cafe", emoji: "☕" },
  { href: "/notebook/checkout", label: "Checkout", emoji: "📋" },
] as const;

export function NotebookBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-1px_6px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-6xl">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/notebook/snooker" &&
              pathname.startsWith("/notebook/snooker"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0 px-1 py-1.5 text-[10px] font-medium",
                isActive
                  ? "text-emerald-800"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <span className="text-base leading-none" aria-hidden>
                {item.emoji}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
