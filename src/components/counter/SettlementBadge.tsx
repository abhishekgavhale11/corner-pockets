"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { NotebookEntryDTO } from "@/types";
import { entryHasCorrections } from "@/lib/utils/entry-corrections";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import {
  counterPayShowsBalanceLabel,
  counterPayShowsPartialAtCheckout,
  counterRowShowsBalance,
  getCounterPayDisplay,
} from "@/lib/utils/counter-pay-display";

function paymentMethodLabel(method: string): string {
  return method === "CASH" ? "Cash" : method === "GPAY" ? "GPay" : "Wallet";
}

export function PartialPaymentLabel({
  paidAmount,
  remaining,
  onBalance,
}: {
  paidAmount: number;
  remaining: number;
  onBalance: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5 leading-none">
      <span className="text-[10px] font-bold text-emerald-700">
        {formatCurrency(paidAmount)} paid
      </span>
      {remaining > 0 && (
        <span
          className={cn(
            "text-[10px] font-bold",
            onBalance ? "text-amber-700" : "text-gray-500"
          )}
        >
          {onBalance
            ? `${formatCurrency(remaining)} Bal`
            : `${formatCurrency(remaining)} due`}
        </span>
      )}
    </div>
  );
}

function renderCounterPayDisplay(
  entry: NotebookEntryDTO,
  display: NonNullable<ReturnType<typeof getCounterPayDisplay>>
) {
  if (!display.frozen) {
    if (entry.status === "PAID" && entry.paymentMethod) {
      return (
        <span className="text-[11px] font-bold text-emerald-700">
          {paymentMethodLabel(entry.paymentMethod)}
        </span>
      );
    }
    if (counterPayShowsPartialAtCheckout(display)) {
      return (
        <PartialPaymentLabel
          paidAmount={display.paidAmount}
          remaining={display.balanceAmount}
          onBalance={false}
        />
      );
    }
    if (counterPayShowsBalanceLabel(display)) {
      return (
        <span className="text-[11px] font-bold text-amber-700">
          {formatCurrency(display.balanceAmount)} Bal
        </span>
      );
    }
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  if (display.paidAmount > 0 && display.balanceAmount > 0) {
    return (
      <PartialPaymentLabel
        paidAmount={display.paidAmount}
        remaining={display.balanceAmount}
        onBalance
      />
    );
  }

  if (display.paidAmount > 0) {
    return (
      <span className="text-[11px] font-bold text-emerald-700">
        {formatCurrency(display.paidAmount)} paid
      </span>
    );
  }

  if (counterPayShowsBalanceLabel(display)) {
    return (
      <span className="text-[11px] font-bold text-amber-700">
        {formatCurrency(display.balanceAmount)} Bal
      </span>
    );
  }

  return <span className="text-[11px] text-gray-400">—</span>;
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

  const display = getCounterPayDisplay(entry);
  if (!display) {
    return null;
  }

  if (display.frozen) {
    return renderCounterPayDisplay(entry, display);
  }

  if (entry.checkoutDismissedAt) {
    return renderCounterPayDisplay(entry, display);
  }

  if (entry.status === "PAID" && entry.paymentMethod) {
    return (
      <span className="text-[11px] font-bold text-emerald-700">
        {paymentMethodLabel(entry.paymentMethod)}
      </span>
    );
  }

  if (counterPayShowsPartialAtCheckout(display)) {
    return (
      <PartialPaymentLabel
        paidAmount={display.paidAmount}
        remaining={display.balanceAmount}
        onBalance={false}
      />
    );
  }

  if (counterPayShowsBalanceLabel(display)) {
    return (
      <span className="text-[11px] font-bold text-amber-700">
        {formatCurrency(display.balanceAmount)} Bal
      </span>
    );
  }

  return <span className="text-[11px] text-gray-400">—</span>;
}

export function entryRowBaseClass(entry: NotebookEntryDTO): string {
  const paid = isPaidLedgerEntry(entry);

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    !paid &&
      counterRowShowsBalance(entry) &&
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
  if (entry.checkoutDismissedAt) {
    return false;
  }
  if (entry.status === "PAID") return true;
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.every((contributor) => contributor.status === "PAID");
  }
  return false;
}

function isPaidContributor(
  contributor: { status: "PENDING" | "PAID" },
  entry: NotebookEntryDTO
): boolean {
  if (entry.checkoutDismissedAt) {
    return false;
  }
  return contributor.status === "PAID";
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
  contributor: { status: "PENDING" | "PAID" }
): string {
  const contributorPaid = isPaidContributor(contributor, entry);

  return cn(
    "text-[14px] leading-snug hover:bg-gray-50",
    entryHasCorrections(entry) && !contributorPaid && "bg-amber-50/25",
    entry.status === "CANCELLED" && "opacity-55",
    entry.status === "REVERSED" && "bg-amber-50/20",
    index > 0 && ledgerSplitDividerClass,
    index === total - 1 && ledgerEntryDividerClass
  );
}
