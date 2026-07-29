"use client";

import { cn } from "@/lib/utils/cn";

export type CashGpayMode = "CASH" | "GPAY";
export type PaymentModeOption = CashGpayMode;

type ModeOption = {
  id: PaymentModeOption;
  label: string;
};

const OPTIONS: ModeOption[] = [
  { id: "CASH", label: "Cash" },
  { id: "GPAY", label: "GPay" },
];

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M3.5 8.25 6.4 11.2 12.5 4.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModeIcon({
  mode,
  className,
}: {
  mode: PaymentModeOption;
  className?: string;
}) {
  if (mode === "CASH") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
        <rect
          x="2.5"
          y="5"
          width="15"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M4 6.5h12v7H4v-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 8.5h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="11.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

interface CashGpaySegmentedControlProps {
  value: PaymentModeOption | "";
  onChange: (value: PaymentModeOption) => void;
  disabled?: boolean;
  /** `md` dialogs; `sm` compact split; `lg` premium POS row (~46px). */
  size?: "sm" | "md" | "lg";
  className?: string;
  idPrefix?: string;
  "aria-label"?: string;
}

/**
 * Shared payment-mode segmented control (Cash / GPay).
 * Selected: solid primary green + white text.
 * Unselected: white surface, subtle border.
 */
export function CashGpaySegmentedControl({
  value,
  onChange,
  disabled = false,
  size = "md",
  className,
  idPrefix = "pay-mode",
  "aria-label": ariaLabel = "Payment mode",
}: CashGpaySegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex gap-1.5", className)}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.id;

        return (
          <button
            key={option.id}
            id={`${idPrefix}-${option.id.toLowerCase()}`}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative inline-flex flex-1 items-center justify-center font-semibold transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1",
              size === "lg" &&
                "h-[46px] flex-col gap-0.5 rounded-[11px] px-2 text-[12px] leading-none",
              size === "md" && "h-11 gap-1.5 rounded-[10px] px-2.5 text-sm",
              size === "sm" && "h-9 gap-1 rounded-lg px-1.5 text-[11px]",
              selected
                ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/25"
                : "border border-gray-200 bg-white text-gray-700 shadow-sm shadow-gray-900/5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900",
              disabled && "cursor-not-allowed opacity-40"
            )}
          >
            {selected && size !== "lg" ? (
              <CheckIcon
                className={cn(
                  "shrink-0 text-white",
                  size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
                )}
              />
            ) : null}
            {size === "lg" ? (
              <ModeIcon
                mode={option.id}
                className={cn(
                  "h-4 w-4 shrink-0",
                  selected ? "text-white" : "text-gray-500"
                )}
              />
            ) : null}
            <span className="relative">
              {option.label}
              {selected && size === "lg" ? (
                <span
                  className="absolute -right-3.5 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-emerald-800"
                  aria-hidden
                >
                  <CheckIcon className="h-2 w-2" />
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
