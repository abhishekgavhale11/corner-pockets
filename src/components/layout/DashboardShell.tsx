"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StaffRole } from "@/lib/auth/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "cpos-sidebar-open";

interface DashboardShellProps {
  role: StaffRole;
  topBar: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ role, topBar, children }: DashboardShellProps) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

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
    <div className="flex min-h-screen bg-gray-50">
      {open && <Sidebar role={role} onHide={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-stretch border-b border-gray-200 bg-white">
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
        <main className="flex-1 overflow-auto p-1.5 sm:p-2">{children}</main>
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
