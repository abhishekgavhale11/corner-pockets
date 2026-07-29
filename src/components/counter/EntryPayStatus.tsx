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

  return cn(
    "text-[14px] leading-snug transition-colors hover:bg-emerald-50/40",
    !paid && due > 0 && !entryHasContributors(entry) && "bg-amber-50/25",
    !paid &&
      entry.isUnassigned &&
      entry.status === "PENDING" &&
      !entryHasContributors(entry) &&
      "bg-amber-50/35",
    entryHasCorrections(entry) && !paid && "bg-amber-50/30",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20"
  );
}

/** Solid divider between separate ledger entries */
export const ledgerEntryDividerClass = "border-b border-gray-100";

/** Lighter dashed divider between contributors in the same split */
export const ledgerSplitDividerClass = "border-t border-dashed border-gray-100";

export function entryRowClass(entry: NotebookEntryDTO): string {
  return cn(entryRowBaseClass(entry), ledgerEntryDividerClass);
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
    "text-[14px] leading-snug transition-colors hover:bg-emerald-50/40",
    entryHasCorrections(entry) && !contributorPaid && "bg-amber-50/30",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20",
    index < total - 1 ? ledgerSplitDividerClass : ledgerEntryDividerClass
  );
}
