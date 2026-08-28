import { cn } from "@/lib/utils/cn";
import type { NotebookEntryDTO } from "@/types";
import { entryHasCorrections } from "@/lib/utils/entry-corrections";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { frameDueFromParts } from "@/lib/utils/frame-payment";

function isFrameFullyPaid(entry: NotebookEntryDTO): boolean {
  if (entry.status === "PAID") return true;
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.every(
      (contributor) =>
        frameDueFromParts(
          contributor.amount,
          contributor.paidAmount,
          contributor.balanceCollectedAmount
        ) <= 0
    );
  }
  return (
    frameDueFromParts(
      entry.amount,
      entry.paidAmount,
      entry.balanceCollectedAmount
    ) <= 0
  );
}

export function entryRowBaseClass(entry: NotebookEntryDTO): string {
  const paid = isFrameFullyPaid(entry);
  const due = frameDueFromParts(
    entry.amount,
    entry.paidAmount,
    entry.balanceCollectedAmount
  );

  const hasOutstanding = !paid && due > 0;

  return cn(
    "bg-[#fbfdfc] text-[13px] leading-snug transition-colors hover:bg-white/70",
    hasOutstanding && !entryHasContributors(entry) && "bg-red-50",
    !paid &&
      entry.isUnassigned &&
      entry.status === "PENDING" &&
      !entryHasContributors(entry) &&
      "bg-red-50",
    entryHasCorrections(entry) && !paid && "bg-red-50",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20"
  );
}

/** Solid divider between separate ledger entries */
export const ledgerEntryDividerClass = "border-b border-black/[0.05]";

/** Stronger divider so unpaid frames are easy to scan */
export const ledgerOutstandingDividerClass = "border-b border-red-200";

/** Lighter dashed divider between contributors in the same split */
export const ledgerSplitDividerClass = "border-t border-dashed border-black/[0.06]";

export function entryRowClass(entry: NotebookEntryDTO): string {
  const paid = isFrameFullyPaid(entry);
  const due = frameDueFromParts(
    entry.amount,
    entry.paidAmount,
    entry.balanceCollectedAmount
  );
  const hasOutstanding = !paid && due > 0 && entry.status !== "CANCELLED";

  return cn(
    entryRowBaseClass(entry),
    hasOutstanding ? ledgerOutstandingDividerClass : ledgerEntryDividerClass
  );
}

export function splitContributorRowClass(
  entry: NotebookEntryDTO,
  index: number,
  total: number,
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number]
): string {
  const contributorPaid =
    frameDueFromParts(
      contributor.amount,
      contributor.paidAmount,
      contributor.balanceCollectedAmount
    ) <= 0;

  return cn(
    "bg-[#fbfdfc] text-[13px] leading-snug transition-colors hover:bg-white/70",
    !contributorPaid && "bg-red-50",
    entryHasCorrections(entry) && !contributorPaid && "bg-red-50",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20",
    index < total - 1
      ? !contributorPaid
        ? "border-t border-red-200"
        : ledgerSplitDividerClass
      : !contributorPaid
        ? ledgerOutstandingDividerClass
        : ledgerEntryDividerClass
  );
}
