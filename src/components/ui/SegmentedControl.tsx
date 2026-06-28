"use client";

import { cn } from "@/lib/utils/cn";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2",
        className
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2",
              selected
                ? "bg-emerald-800 text-white shadow-sm"
                : "text-gray-700 hover:bg-white",
              buttonClassName
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
