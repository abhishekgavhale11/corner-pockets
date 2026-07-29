"use client";

import { cn } from "@/lib/utils/cn";

export type EntryBillingMode = "single" | "split";

interface BillingModeToggleProps {
  value: EntryBillingMode;
  onChange: (mode: EntryBillingMode) => void;
  disabled?: boolean;
  className?: string;
}

export function BillingModeToggle({
  value,
  onChange,
  disabled = false,
  className,
}: BillingModeToggleProps) {
  return (
    <div className={cn(className)}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">
        Frame Ownership
      </p>
      <div
        role="radiogroup"
        aria-label="Frame ownership"
        className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
      >
        {(
          [
            { id: "single" as const, label: "Single customer" },
            { id: "split" as const, label: "Split" },
          ] as const
        ).map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1",
                selected
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
