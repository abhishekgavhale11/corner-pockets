"use client";

import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export type DueStatusPaymentMode = "CASH" | "GPAY" | "" | null;

/** True when Cash or GPay is selected (not Unassigned / empty / null). */
export function isPaymentModeSelected(
  paymentMode: DueStatusPaymentMode | undefined
): boolean {
  return paymentMode === "CASH" || paymentMode === "GPAY";
}

/**
 * Display-only Due status for Edit Frame / payment rows.
 * Does not change calculations or validation.
 */
export function DueStatusBadge({
  dueAmount,
  paymentMode,
  /** When false, never show Paid (e.g. customer still Unassigned). */
  allowPaidStatus = true,
  size = "md",
}: {
  dueAmount: number;
  paymentMode: DueStatusPaymentMode | undefined;
  allowPaidStatus?: boolean;
  size?: "sm" | "md";
}) {
  const pill = cn(
    "inline-flex items-center gap-1.5 rounded-full font-bold tabular-nums",
    size === "md" ? "px-3.5 py-2.5 text-[14px]" : "px-2.5 py-1 text-xs"
  );

  if (dueAmount > 0) {
    return (
      <span
        className={cn(
          pill,
          "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
        )}
      >
        {formatCurrency(dueAmount)} Due
      </span>
    );
  }

  if (allowPaidStatus && isPaymentModeSelected(paymentMode)) {
    return (
      <span
        className={cn(
          pill,
          "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
        )}
      >
        <span aria-hidden>✓</span>
        Paid
      </span>
    );
  }

  if (!allowPaidStatus) {
    return (
      <span className={cn(pill, "bg-gray-100 font-semibold text-gray-500")}>
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        pill,
        "bg-amber-50 font-semibold text-amber-800 ring-1 ring-inset ring-amber-100"
      )}
    >
      Select Payment Mode
    </span>
  );
}
