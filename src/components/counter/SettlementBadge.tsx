"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { NotebookEntryDTO } from "@/types";
import { entryHasCorrections } from "@/lib/utils/entry-corrections";
import { getCounterPayDisplay } from "@/lib/utils/counter-pay-display";
import { counterRowHasRemainingBalance } from "@/lib/utils/counter-visit-display";
import { entryAmountRemaining, entryHasContributors } from "@/lib/utils/entry-contributors";
import { entryTotalPaidAmount } from "@/lib/utils/freeze-counter-pay-snapshot";
import {
  formatCounterRemainingText,
  resolveCounterPayLineViewForEntry,
  type CounterPayLineView,
  type CounterRemainingKind,
} from "@/lib/utils/counter-visit-display";

export function PartialPaymentLabel({
  paidAmount,
  remaining,
  remainingKind,
}: {
  paidAmount: number;
  remaining: number;
  remainingKind: CounterRemainingKind;
}) {
  const remainingTone =
    remainingKind === "outstanding" ? "text-amber-700" : "text-gray-500";

  return (
    <div className="flex flex-col items-end gap-0.5 leading-none">
      <span className="text-[10px] font-bold text-emerald-700">
        {formatCurrency(paidAmount)} paid
      </span>
      {remaining > 0 && (
        <span className={cn("text-[10px] font-bold", remainingTone)}>
          {formatCounterRemainingText(remaining, remainingKind)}
        </span>
      )}
    </div>
  );
}

export function CounterPayLine({ view }: { view: CounterPayLineView }) {
  switch (view.kind) {
    case "dash":
      return <span className="text-[11px] text-gray-400">—</span>;
    case "fully_paid_finished":
      return (
        <span className="text-[11px] font-bold text-emerald-700">✓ Paid</span>
      );
    case "fully_paid_active":
      return (
        <span className="text-[11px] font-bold text-emerald-700">
          {formatCurrency(view.paidAmount)} paid
        </span>
      );
    case "partial":
      return (
        <PartialPaymentLabel
          paidAmount={view.paidAmount}
          remaining={view.remainingAmount}
          remainingKind={view.remainingKind}
        />
      );
    case "remaining_only": {
      const tone =
        view.remainingKind === "outstanding"
          ? "text-amber-700"
          : "text-gray-500";
      return (
        <span className={cn("text-[11px] font-bold", tone)}>
          {formatCounterRemainingText(
            view.remainingAmount,
            view.remainingKind
          )}
        </span>
      );
    }
    default:
      return <span className="text-[11px] text-gray-400">—</span>;
  }
}

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

  const view = resolveCounterPayLineViewForEntry(entry);
  if (view.kind === "dash" && !getCounterPayDisplay(entry)) {
    return null;
  }

  return <CounterPayLine view={view} />;
}

export function entryRowBaseClass(entry: NotebookEntryDTO): string {
  const paid = isPaidLedgerEntry(entry);
  const display = getCounterPayDisplay(entry);

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    entry.visitStatus === "FINISHED" && "bg-slate-50/90 hover:bg-slate-50/90",
    !paid &&
      counterRowHasRemainingBalance(display) &&
      !entryHasContributors(entry) &&
      "bg-amber-50/20",
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

function isPaidLedgerEntry(entry: NotebookEntryDTO): boolean {
  if (entry.visitStatus === "FINISHED") {
    const display = getCounterPayDisplay(entry);
    return display != null && display.balanceAmount <= 0 && display.paidAmount > 0;
  }

  if (entry.status === "PAID") return true;
  if (
    entry.amount > 0 &&
    entryTotalPaidAmount(entry) >= entry.amount &&
    entryAmountRemaining(entry) <= 0
  ) {
    return true;
  }
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.every((contributor) => contributor.status === "PAID");
  }
  return false;
}

function isPaidContributor(
  contributor: {
    status: "PENDING" | "PAID";
    amount: number;
    paidAmount?: number;
    balanceCollectedAmount?: number;
    visitStatus?: NotebookEntryDTO["visitStatus"];
  },
  entry: NotebookEntryDTO
): boolean {
  if (contributor.visitStatus === "FINISHED" || entry.visitStatus === "FINISHED") {
    const paid =
      (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0);
    return paid >= contributor.amount && contributor.amount > 0;
  }

  if (contributor.status === "PAID") return true;
  const paid =
    (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0);
  return paid >= contributor.amount && contributor.amount > 0;
}

/** Solid divider between separate ledger entries */
export const ledgerEntryDividerClass = "border-b border-gray-300";

/** Lighter dashed divider between contributors in the same split */
export const ledgerSplitDividerClass = "border-t border-dashed border-gray-200";

function ledgerEntryDivider(_entry: NotebookEntryDTO): string {
  return ledgerEntryDividerClass;
}

export function entryRowClass(entry: NotebookEntryDTO): string {
  return cn(entryRowBaseClass(entry), ledgerEntryDivider(entry));
}

export function splitContributorRowClass(
  entry: NotebookEntryDTO,
  index: number,
  total: number,
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number]
): string {
  const contributorPaid = isPaidContributor(contributor, entry);

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    contributor.visitStatus === "FINISHED" && "bg-slate-50/90 hover:bg-slate-50/90",
    entryHasCorrections(entry) && !contributorPaid && "bg-amber-50/25",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20",
    index > 0 && ledgerSplitDividerClass,
    index === total - 1 && ledgerEntryDividerClass
  );
}
