import type { NotebookEntryContributorDTO, NotebookEntryDTO } from "@/types";
import {
  entryAmountRemaining,
  isEntryOnCustomerBalance,
} from "@/lib/utils/entry-contributors";
import { formatCurrency } from "@/lib/utils/format";

export type CounterPayDisplay = {
  paidAmount: number;
  balanceAmount: number;
  onBalance: boolean;
  frozen: boolean;
};

export type CounterRemainingKind = "due" | "outstanding";

export type CounterPayLineView =
  | { kind: "dash" }
  | { kind: "fully_paid_finished" }
  | { kind: "fully_paid_active"; paidAmount: number }
  | {
      kind: "partial";
      paidAmount: number;
      remainingAmount: number;
      remainingKind: CounterRemainingKind;
    }
  | {
      kind: "remaining_only";
      remainingAmount: number;
      remainingKind: CounterRemainingKind;
    };

function entryTotalPaidAmount(
  entry: Pick<NotebookEntryDTO, "paidAmount" | "balanceCollectedAmount">
): number {
  return (entry.paidAmount ?? 0) + (entry.balanceCollectedAmount ?? 0);
}

function contributorTotalPaidAmount(
  contributor: Pick<
    NotebookEntryContributorDTO,
    "paidAmount" | "balanceCollectedAmount"
  >
): number {
  return (
    (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0)
  );
}

function remainingKindForDisplay(
  display: CounterPayDisplay
): CounterRemainingKind {
  return display.onBalance || display.frozen ? "outstanding" : "due";
}

/**
 * Counter Pay column amounts — paid/remaining from entry fields only.
 */
export function getCounterPayDisplay(
  entry: NotebookEntryDTO
): CounterPayDisplay | null {
  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return null;
  }

  if (entry.checkoutDismissedAt) {
    const balanceAmount =
      entry.counterBalanceAmount ?? entryAmountRemaining(entry);
    return {
      paidAmount:
        entry.counterPaidAmount ?? Math.max(0, entry.amount - balanceAmount),
      balanceAmount,
      onBalance: balanceAmount > 0,
      frozen: true,
    };
  }

  if (entry.status === "PAID" && entry.paymentMethod) {
    return {
      paidAmount: entry.amount,
      balanceAmount: 0,
      onBalance: false,
      frozen: false,
    };
  }

  if (entry.status === "PENDING" || entry.status === "PAID") {
    const paidAmount = entryTotalPaidAmount(entry);
    const balanceAmount = entryAmountRemaining(entry);
    if (paidAmount > 0 && balanceAmount <= 0) {
      return {
        paidAmount: entry.amount,
        balanceAmount: 0,
        onBalance: false,
        frozen: false,
      };
    }
    if (paidAmount > 0) {
      return {
        paidAmount,
        balanceAmount,
        onBalance: isEntryOnCustomerBalance(entry),
        frozen: false,
      };
    }
    return {
      paidAmount: 0,
      balanceAmount: entry.amount,
      onBalance: isEntryOnCustomerBalance(entry),
      frozen: false,
    };
  }

  return null;
}

export function getContributorCounterPayDisplay(
  entry: NotebookEntryDTO,
  contributor: NotebookEntryContributorDTO
): CounterPayDisplay {
  if (entry.checkoutDismissedAt) {
    const paidAmount = contributorTotalPaidAmount(contributor);
    const balanceAmount = Math.max(0, contributor.amount - paidAmount);
    return {
      paidAmount:
        contributor.counterPaidAmount ??
        Math.max(0, contributor.amount - balanceAmount),
      balanceAmount: contributor.counterBalanceAmount ?? balanceAmount,
      onBalance: balanceAmount > 0,
      frozen: true,
    };
  }

  if (contributor.status === "PAID" && contributor.paymentMethod) {
    return {
      paidAmount: contributor.amount,
      balanceAmount: 0,
      onBalance: false,
      frozen: false,
    };
  }

  const paidAmount = contributorTotalPaidAmount(contributor);
  const balanceAmount = Math.max(0, contributor.amount - paidAmount);
  if (paidAmount > 0 && balanceAmount <= 0) {
    return {
      paidAmount: contributor.amount,
      balanceAmount: 0,
      onBalance: false,
      frozen: false,
    };
  }
  return {
    paidAmount,
    balanceAmount,
    onBalance: isEntryOnCustomerBalance(entry),
    frozen: false,
  };
}

export function counterRowHasRemainingBalance(
  display: CounterPayDisplay | null
): boolean {
  return Boolean(display && display.balanceAmount > 0);
}

export function formatCounterRemainingText(
  remaining: number,
  remainingKind: CounterRemainingKind
): string {
  const label = remainingKind === "outstanding" ? "Outstanding" : "Due";
  return `${formatCurrency(remaining)} ${label}`;
}

export function resolveCounterPayLineViewForEntry(
  entry: NotebookEntryDTO
): CounterPayLineView {
  const display = getCounterPayDisplay(entry);
  if (!display) return { kind: "dash" };

  if (display.paidAmount > 0 && display.balanceAmount <= 0) {
    return { kind: "fully_paid_finished" };
  }

  if (display.paidAmount > 0 && display.balanceAmount > 0) {
    return {
      kind: "partial",
      paidAmount: display.paidAmount,
      remainingAmount: display.balanceAmount,
      remainingKind: remainingKindForDisplay(display),
    };
  }

  if (display.balanceAmount > 0) {
    return {
      kind: "remaining_only",
      remainingAmount: display.balanceAmount,
      remainingKind: remainingKindForDisplay(display),
    };
  }

  return { kind: "dash" };
}

export function resolveContributorCounterPayLineView(
  entry: NotebookEntryDTO,
  contributor: NotebookEntryContributorDTO
): CounterPayLineView {
  const display = getContributorCounterPayDisplay(entry, contributor);

  if (display.paidAmount > 0 && display.balanceAmount <= 0) {
    return { kind: "fully_paid_finished" };
  }

  if (display.paidAmount > 0 && display.balanceAmount > 0) {
    return {
      kind: "partial",
      paidAmount: display.paidAmount,
      remainingAmount: display.balanceAmount,
      remainingKind: remainingKindForDisplay(display),
    };
  }

  if (display.balanceAmount > 0) {
    return {
      kind: "remaining_only",
      remainingAmount: display.balanceAmount,
      remainingKind: remainingKindForDisplay(display),
    };
  }

  return { kind: "dash" };
}

export function counterPayShowsFullAtCheckout(
  display: CounterPayDisplay
): boolean {
  return (
    !display.frozen && display.paidAmount > 0 && display.balanceAmount <= 0
  );
}

export function counterPayShowsPartialAtCheckout(
  display: CounterPayDisplay
): boolean {
  return (
    !display.frozen && display.paidAmount > 0 && display.balanceAmount > 0
  );
}

export function counterPayShowsBalanceLabel(display: CounterPayDisplay): boolean {
  return display.balanceAmount > 0 && (display.onBalance || display.frozen);
}
