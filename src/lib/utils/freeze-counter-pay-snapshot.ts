import { entryAmountRemaining } from "@/lib/utils/entry-contributors";
import type { NotebookEntryDTO } from "@/types";
import type { INotebookEntry } from "@/models/NotebookEntry";

type BalancePaymentRow = {
  createdAt: Date;
  allocations: { entryId: { toString(): string }; amount: number }[];
};

function owedOnEntry(entry: INotebookEntry): number {
  if (entry.status === "CANCELLED") {
    return 0;
  }
  if (entry.status === "PAID") {
    return 0;
  }
  return Math.max(
    0,
    entry.amount -
      (entry.paidAmount ?? 0) -
      (entry.balanceCollectedAmount ?? 0)
  );
}

function owedOnContributor(
  contributor: INotebookEntry["contributors"][number]
): number {
  if (contributor.status === "PAID") {
    return 0;
  }
  return Math.max(
    0,
    contributor.amount -
      (contributor.paidAmount ?? 0) -
      (contributor.balanceCollectedAmount ?? 0)
  );
}

export function entryTotalPaidAmount(
  entry: Pick<INotebookEntry, "paidAmount" | "balanceCollectedAmount">
): number {
  return (entry.paidAmount ?? 0) + (entry.balanceCollectedAmount ?? 0);
}

export function contributorTotalPaidAmount(
  contributor: Pick<
    INotebookEntry["contributors"][number],
    "paidAmount" | "balanceCollectedAmount"
  >
): number {
  return (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0);
}

function paidBeforeDismiss(
  entryId: string,
  dismissedAt: Date,
  payments: BalancePaymentRow[]
): number {
  let total = 0;
  for (const payment of payments) {
    if (payment.createdAt >= dismissedAt) {
      continue;
    }
    for (const allocation of payment.allocations) {
      if (allocation.entryId.toString() === entryId) {
        total += allocation.amount;
      }
    }
  }
  return total;
}

function snapshotFromDismissPayments(
  entry: INotebookEntry,
  payments: BalancePaymentRow[]
): { paidAmount: number; balanceAmount: number } {
  const dismissedAt = entry.checkoutDismissedAt!;
  const paidAtDismiss = paidBeforeDismiss(entry._id.toString(), dismissedAt, payments);
  const balanceAtDismiss = Math.max(0, entry.amount - paidAtDismiss);
  return {
    paidAmount: Math.max(0, entry.amount - balanceAtDismiss),
    balanceAmount: balanceAtDismiss,
  };
}

function snapshotParts(entry: {
  amount: number;
  counterPaidAmount?: number | null;
  counterBalanceAmount?: number | null;
}) {
  return {
    paid: entry.counterPaidAmount ?? 0,
    balance: entry.counterBalanceAmount ?? 0,
  };
}

export function isStaleCounterSnapshot(
  entry: Pick<
    INotebookEntry,
    | "amount"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "counterPaidAmount"
    | "counterBalanceAmount"
    | "status"
    | "checkoutDismissedAt"
  >
): boolean {
  return isStaleCounterSnapshotParts(entry);
}

export function isStaleCounterSnapshotDto(
  entry: Pick<
    NotebookEntryDTO,
    | "amount"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "counterPaidAmount"
    | "counterBalanceAmount"
    | "status"
    | "checkoutDismissedAt"
  >
): boolean {
  return isStaleCounterSnapshotParts(entry);
}

function isStaleCounterSnapshotParts(
  entry: Pick<
    INotebookEntry | NotebookEntryDTO,
    | "amount"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "counterPaidAmount"
    | "counterBalanceAmount"
    | "status"
    | "checkoutDismissedAt"
  >
): boolean {
  const { paid, balance } = snapshotParts(entry);
  const totalPaid = entryTotalPaidAmount(entry);

  if (entry.counterPaidAmount == null || entry.counterBalanceAmount == null) {
    return true;
  }

  if (paid + balance !== entry.amount) {
    return true;
  }

  if (totalPaid > 0 && paid === 0 && balance === entry.amount) {
    return true;
  }

  if (totalPaid > 0 && paid < totalPaid && entry.status === "PAID") {
    return true;
  }

  if (entry.status === "PAID" && balance === 0 && paid === entry.amount && entry.checkoutDismissedAt) {
    return true;
  }

  return false;
}

/** Freeze counter Pay column at pay-later — never changes after ledger collection. */
export function freezeCounterPaySnapshot(
  entry: INotebookEntry,
  payments: BalancePaymentRow[] = []
): void {
  if (!entry.checkoutDismissedAt) {
    return;
  }

  if (
    entry.counterPaidAmount != null &&
    entry.counterBalanceAmount != null &&
    !isStaleCounterSnapshot(entry)
  ) {
    return;
  }

  let paidAmount: number;
  let balanceAmount: number;

  if (payments.length > 0) {
    ({ paidAmount, balanceAmount } = snapshotFromDismissPayments(entry, payments));
  } else {
    const owed = owedOnEntry(entry);
    paidAmount = Math.max(0, entry.amount - owed);
    balanceAmount = owed;
  }

  entry.counterPaidAmount = paidAmount;
  entry.counterBalanceAmount = balanceAmount;

  for (const contributor of entry.contributors ?? []) {
    const contributorOwed = owedOnContributor(contributor);
    contributor.counterPaidAmount = Math.max(
      0,
      contributor.amount - contributorOwed
    );
    contributor.counterBalanceAmount = contributorOwed;
  }
}

export function ensureCounterPaySnapshot(
  entry: INotebookEntry,
  payments: BalancePaymentRow[] = []
): boolean {
  if (!entry.checkoutDismissedAt) {
    return false;
  }
  if (!isStaleCounterSnapshot(entry)) {
    return false;
  }
  freezeCounterPaySnapshot(entry, payments);
  return true;
}

/** Immutable counter Pay display for pay-later rows — ledger collection must not change this. */
export function frozenPayFromEntryDto(entry: NotebookEntryDTO): {
  paidAmount: number;
  balanceAmount: number;
} {
  if (
    entry.counterPaidAmount != null &&
    entry.counterBalanceAmount != null &&
    !isStaleCounterSnapshotDto(entry)
  ) {
    return {
      paidAmount: entry.counterPaidAmount,
      balanceAmount: entry.counterBalanceAmount,
    };
  }

  if (entry.status === "PENDING") {
    const balanceAmount = entryAmountRemaining(entry);
    return {
      paidAmount: Math.max(0, entry.amount - balanceAmount),
      balanceAmount,
    };
  }

  if (entry.counterPaidAmount != null && entry.counterBalanceAmount != null) {
    return {
      paidAmount: entry.counterPaidAmount,
      balanceAmount: entry.counterBalanceAmount,
    };
  }

  const totalPaid = entryTotalPaidAmount(entry);
  return {
    paidAmount: totalPaid,
    balanceAmount: Math.max(0, entry.amount - totalPaid),
  };
}

export function payLaterBalanceAtDismiss(
  entry: Pick<
    NotebookEntryDTO,
    "counterBalanceAmount" | "counterPaidAmount" | "amount"
  >
): number {
  if (entry.counterBalanceAmount != null) {
    return entry.counterBalanceAmount;
  }
  if (entry.counterPaidAmount != null) {
    return Math.max(0, entry.amount - entry.counterPaidAmount);
  }
  return 0;
}
