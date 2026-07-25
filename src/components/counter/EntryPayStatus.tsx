import { cn } from "@/lib/utils/cn";
import type { NotebookEntryDTO } from "@/types";
import { entryHasCorrections } from "@/lib/utils/entry-corrections";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";

function isFrameFullyPaid(entry: NotebookEntryDTO): boolean {
  if (entry.status === "PAID") return true;
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.every(
      (contributor) =>
        frameDueAmount(contributor.amount, framePaidAmount(contributor.paidAmount)) <=
        0
    );
  }
  return frameDueAmount(entry.amount, framePaidAmount(entry.paidAmount)) <= 0;
}

export function entryRowBaseClass(entry: NotebookEntryDTO): string {
  const paid = isFrameFullyPaid(entry);
  const due = frameDueAmount(entry.amount, framePaidAmount(entry.paidAmount));

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    !paid && due > 0 && !entryHasContributors(entry) && "bg-amber-50/20",
    !paid &&
      entry.isUnassigned &&
      entry.status === "PENDING" &&
      !entryHasContributors(entry) &&
      "bg-amber-50/30",
    entryHasCorrections(entry) && !paid && "bg-amber-50/25",
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
  total: number,
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number]
): string {
  const contributorPaid =
    frameDueAmount(contributor.amount, framePaidAmount(contributor.paidAmount)) <=
    0;

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    entryHasCorrections(entry) && !contributorPaid && "bg-amber-50/25",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20",
    index > 0 && ledgerSplitDividerClass,
    index === total - 1 && ledgerEntryDividerClass
  );
}
