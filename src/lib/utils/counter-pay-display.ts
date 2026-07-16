import type { NotebookEntryContributorDTO, NotebookEntryDTO } from "@/types";
import {
  entryAmountRemaining,
  isEntryOnCustomerBalance,
} from "@/lib/utils/entry-contributors";
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
 * Counter Pay column amounts (FR-CTR-001 / FR-VIS-016).
 * Payment methods never appear on Counter — only paid/remaining amounts.
 * Remaining label (Due vs Outstanding) is resolved in counter-visit-display.ts.
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
