"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/lib/auth/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { CounterShellSlotContext } from "@/components/layout/CounterShellSlot";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "cpos-sidebar-open";

/** Counter workspace canvas — very light mint, soft tonal variation. */
const COUNTER_WORKSPACE_BG =
  "bg-[#eef6f1] bg-[radial-gradient(120%_80%_at_8%_0%,rgba(255,255,255,0.72),transparent_52%),radial-gradient(90%_70%_at_100%_100%,rgba(167,243,208,0.28),transparent_55%)]";

interface DashboardShellProps {
  role: StaffRole;
  topBar: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ role, topBar, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [tabsSlot, setTabsSlot] = useState<HTMLDivElement | null>(null);
  const isCounterWorkspace = pathname.startsWith("/counter");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "0") setOpen(false);
      if (stored === "1") setOpen(true);
    } catch {
      // ignore storage errors
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [open, ready]);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-gray-50">
      {open && <Sidebar role={role} onHide={() => setOpen(false)} />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-stretch border-b border-gray-200 bg-white">
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center border-r border-gray-200",
                "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <MenuIcon />
            </button>
          )}
          <div className="min-w-0 flex-1">{topBar}</div>
        </div>
        {/* Counter workspace tabs portal here — flush against the header,
            outside main's padding, so there is never a gap or scroll-through. */}
        <div ref={setTabsSlot} className="shrink-0 bg-gray-50" />
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto p-1.5 sm:p-2",
            isCounterWorkspace ? COUNTER_WORKSPACE_BG : undefined
          )}
        >
          <CounterShellSlotContext.Provider value={tabsSlot}>
            {children}
          </CounterShellSlotContext.Provider>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
