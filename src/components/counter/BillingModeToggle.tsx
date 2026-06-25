"use client";

import { cn } from "@/lib/utils/cn";

export type EntryBillingMode = "single" | "split";

interface BillingModeToggleProps {
  value: EntryBillingMode;
  onChange: (mode: EntryBillingMode) => void;
  disabled?: boolean;
}

export function BillingModeToggle({
  value,
  onChange,
  disabled = false,
}: BillingModeToggleProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
        Billing
      </p>
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("single")}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
            value === "single"
              ? "bg-white text-emerald-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          One customer
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("split")}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
            value === "split"
              ? "bg-white text-emerald-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          Split bill
        </button>
      </div>
    </div>
  );
}
