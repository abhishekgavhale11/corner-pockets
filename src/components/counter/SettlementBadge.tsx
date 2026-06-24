"use client";

import { cn } from "@/lib/utils/cn";
import type { NotebookEntryDTO } from "@/types";
import { entryHasCorrections } from "@/lib/utils/entry-corrections";
import { entryHasContributors } from "@/lib/utils/entry-contributors";

export function SettlementBadge({ entry }: { entry: NotebookEntryDTO }) {
  if (entry.status === "CANCELLED") {
    return (
      <span className="text-[11px] font-bold text-red-500">Cancelled</span>
    );
  }

  if (entry.status === "REVERSED") {
    return (
      <span className="text-[11px] font-bold text-amber-600">Reversed</span>
    );
  }

  if (entry.status === "PAID" && entry.paymentMethod) {
    const label =
      entry.paymentMethod === "CASH"
        ? "Cash"
        : entry.paymentMethod === "GPAY"
          ? "GPay"
          : "Wallet";
    return (
      <span className="text-[11px] font-bold text-emerald-700">{label}</span>
    );
  }

  if (entry.status === "PENDING") {
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  return null;
}

export function entryRowBaseClass(entry: NotebookEntryDTO): string {
  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    entry.isUnassigned &&
      entry.status === "PENDING" &&
      !entryHasContributors(entry) &&
      "bg-amber-50/30",
    entryHasCorrections(entry) && "bg-amber-50/25",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20"
  );
}

/** Solid divider between separate ledger entries */
export const ledgerEntryDividerClass = "border-b border-gray-300";

/** Lighter dashed divider between contributors in the same split */
export const ledgerSplitDividerClass = "border-t border-dashed border-gray-200";

export function entryRowClass(entry: NotebookEntryDTO): string {
  return cn(entryRowBaseClass(entry), ledgerEntryDividerClass);
}

export function splitContributorRowClass(
  entry: NotebookEntryDTO,
  index: number,
  total: number
): string {
  return cn(
    entryRowBaseClass(entry),
    index > 0 && ledgerSplitDividerClass,
    index === total - 1 && ledgerEntryDividerClass
  );
}
