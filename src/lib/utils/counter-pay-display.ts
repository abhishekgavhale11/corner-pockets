import type { NotebookEntryContributorDTO, NotebookEntryDTO } from "@/types";
import { entryAmountRemaining, isEntryOnCustomerBalance } from "@/lib/utils/entry-contributors";
import {
  contributorTotalPaidAmount,
  entryTotalPaidAmount,
  frozenPayFromEntryDto,
} from "@/lib/utils/freeze-counter-pay-snapshot";

export type CounterPayDisplay = {
  paidAmount: number;
  balanceAmount: number;
  onBalance: boolean;
  frozen: boolean;
};

function frozenPayFromContributor(
  entry: NotebookEntryDTO,
  contributor: NotebookEntryContributorDTO
): { paidAmount: number; balanceAmount: number } {
  if (entry.checkoutDismissedAt) {
    if (
      contributor.counterPaidAmount != null &&
      contributor.counterBalanceAmount != null
    ) {
      return {
        paidAmount: contributor.counterPaidAmount,
        balanceAmount: contributor.counterBalanceAmount,
      };
    }

    if (contributor.status !== "PAID") {
      const owed = Math.max(
        0,
        contributor.amount - contributorTotalPaidAmount(contributor)
      );
      return {
        paidAmount: Math.max(0, contributor.amount - owed),
        balanceAmount: owed,
      };
    }

    const totalPaid = contributorTotalPaidAmount(contributor);
    return {
      paidAmount: totalPaid,
      balanceAmount: Math.max(0, contributor.amount - totalPaid),
    };
  }

  if (
    contributor.counterPaidAmount != null &&
    contributor.counterBalanceAmount != null
  ) {
    const totalPaid = contributorTotalPaidAmount(contributor);
    const { paid, balance } = {
      paid: contributor.counterPaidAmount,
      balance: contributor.counterBalanceAmount,
    };
    if (
      paid + balance === contributor.amount &&
      !(totalPaid > 0 && paid === 0 && balance === contributor.amount)
    ) {
      return { paidAmount: paid, balanceAmount: balance };
    }
  }

  if (contributor.status !== "PAID") {
    const owed = Math.max(
      0,
      contributor.amount - contributorTotalPaidAmount(contributor)
    );
    return {
      paidAmount: Math.max(0, contributor.amount - owed),
      balanceAmount: owed,
    };
  }

  return {
    paidAmount: contributor.amount,
    balanceAmount: 0,
  };
}

/**
 * Counter Pay column rules:
 * - Playing / checkout open: dash
 * - Full pay at checkout: Cash / GPay / Wallet
 * - Partial pay (not pay later): total paid / due
 * - After pay later: frozen snapshot (e.g. ₹160 paid / ₹20 Bal)
 */
export function getCounterPayDisplay(
  entry: NotebookEntryDTO
): CounterPayDisplay | null {
  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return null;
  }

  if (entry.checkoutDismissedAt) {
    const { paidAmount, balanceAmount } = frozenPayFromEntryDto(entry);
    return {
      paidAmount,
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

  if (entry.status === "PENDING") {
    const paidAmount = entryTotalPaidAmount(entry);
    const balanceAmount = entryAmountRemaining(entry);
    return {
      paidAmount,
      balanceAmount,
      onBalance:
        isEntryOnCustomerBalance(entry) ||
        (Boolean(entry.customerId) && balanceAmount > 0),
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
    const { paidAmount, balanceAmount } = frozenPayFromContributor(
      entry,
      contributor
    );
    return {
      paidAmount,
      balanceAmount,
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
  return {
    paidAmount,
    balanceAmount,
    onBalance:
      isEntryOnCustomerBalance(entry) ||
      (balanceAmount > 0 && contributor.status !== "PAID"),
    frozen: false,
  };
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

export function counterRowShowsBalance(entry: NotebookEntryDTO): boolean {
  const display = getCounterPayDisplay(entry);
  if (!display) return false;
  return counterPayShowsBalanceLabel(display);
}
