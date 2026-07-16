import type { NotebookEntryDTO } from "@/types";

export type ContributorObligation = {
  customerId: string;
  customerName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paymentMethod?: string;
};

export function entryHasContributors(
  entry: { contributors?: unknown[] | null }
): boolean {
  return Boolean(entry.contributors && entry.contributors.length > 0);
}

export function contributorAmountRemaining(
  contributor: Pick<
    import("@/types").NotebookEntryContributorDTO,
    "amount" | "paidAmount" | "balanceCollectedAmount" | "status"
  >
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

export function entryAmountRemaining(
  entry: Pick<
    NotebookEntryDTO,
    | "amount"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "status"
    | "counterBalanceAmount"
  > & { checkoutDismissedAt?: Date | string | null }
): number {
  if (entry.status === "PAID" || entry.status === "CANCELLED") {
    return 0;
  }
  if (
    entry.checkoutDismissedAt &&
    entry.counterBalanceAmount != null
  ) {
    return entry.counterBalanceAmount;
  }
  return Math.max(
    0,
    entry.amount -
      (entry.paidAmount ?? 0) -
      (entry.balanceCollectedAmount ?? 0)
  );
}

export function getEntryCheckoutObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  if (entryHasContributors(entry)) {
    return entry.contributors!
      .map((contributor) => ({
        customerId: contributor.customerId,
        customerName: contributor.customerName,
        amount: contributorAmountRemaining(contributor),
        status: contributor.status,
        paymentMethod: contributor.paymentMethod,
      }))
      .filter((obligation) => obligation.amount > 0);
  }

  if (entry.customerId) {
    const remaining = entryAmountRemaining(entry);
    if (remaining <= 0) {
      return [];
    }

    return [
      {
        customerId: entry.customerId,
        customerName: entry.customerName,
        amount: remaining,
        status: "PENDING",
      },
    ];
  }

  return [];
}

export function getPendingObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  return getEntryCheckoutObligations(entry);
}

/** On customer balance after checkout pay-later (not just counter assign). */
export function isEntryOnCustomerBalance(
  entry: Pick<NotebookEntryDTO, "status" | "customerId" | "checkoutDismissedAt">
): boolean {
  return (
    entry.status === "PENDING" &&
    Boolean(entry.customerId) &&
    Boolean(entry.checkoutDismissedAt)
  );
}

/**
 * Entry has passed checkout finalization (full pay or pay-later dismiss).
 * Partial payments during an open checkout do not commit to the ledger.
 */
export function isEntryLedgerCommitted(
  entry: Pick<
    NotebookEntryDTO,
    | "status"
    | "checkoutDismissedAt"
  >
): boolean {
  if (entry.status === "CANCELLED" || entry.status === "REVERSED") {
    return false;
  }
  if (entry.checkoutDismissedAt) {
    return true;
  }
  if (entry.status === "PAID") {
    return true;
  }
  return false;
}

/** Count toward ledger charges / pay-later outstanding — not counter assignment. */
export function isEntryLedgerChargeable(
  entry: Pick<
    NotebookEntryDTO,
    | "status"
    | "checkoutDismissedAt"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "customerId"
    | "contributors"
  >
): boolean {
  return isEntryLedgerCommitted(entry);
}

/** Pay-later / collected outstanding — excludes active checkout-queue items. */
export function getLedgerObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  if (!isEntryLedgerChargeable(entry)) {
    return [];
  }
  if (!entry.checkoutDismissedAt) {
    return [];
  }
  return getPendingObligations(entry);
}

export function getCheckoutQueueObligations(
  entry: NotebookEntryDTO
): ContributorObligation[] {
  if (entry.checkoutDismissedAt) {
    return [];
  }
  return getPendingObligations(entry);
}

export function isEntryInCheckoutQueue(entry: NotebookEntryDTO): boolean {
  if (entry.status === "CANCELLED") return false;
  return getCheckoutQueueObligations(entry).length > 0;
}

export function isEntryCheckoutEligible(entry: NotebookEntryDTO): boolean {
  if (entry.status === "CANCELLED") return false;
  return getCheckoutQueueObligations(entry).length > 0;
}

/** Unassigned single-customer entry with amount still owed. */
export function isUnassignedPayableEntry(entry: NotebookEntryDTO): boolean {
  if (entry.checkoutDismissedAt) return false;
  if (entry.status === "CANCELLED" || entry.status === "PAID") return false;
  if (entry.customerId || entryHasContributors(entry)) return false;
  return entryAmountRemaining(entry) > 0;
}

export function sessionEntryAmountRemaining(entry: NotebookEntryDTO): number {
  if (entryHasContributors(entry)) {
    return entry.contributors!.reduce(
      (sum, contributor) => sum + contributorAmountRemaining(contributor),
      0
    );
  }
  return entryAmountRemaining(entry);
}

/** Session line still owed at checkout (unassigned to a customer tab). */
export function isSessionPayableEntry(
  entry: NotebookEntryDTO,
  sessionId: string
): boolean {
  if (entry.sessionId !== sessionId) return false;
  if (entry.checkoutDismissedAt) return false;
  if (entry.status === "CANCELLED" || entry.status === "PAID") return false;
  if (entry.customerId) return false;
  return sessionEntryAmountRemaining(entry) > 0;
}

export function contributorSummaryLabel(
  entry: Pick<NotebookEntryDTO, "contributors">
): string {
  const count = entry.contributors?.length ?? 0;
  if (count === 0) return "";
  if (count === 1) {
    const contributor = entry.contributors![0];
    return `${contributor.customerName} ${formatInr(contributor.amount)}`;
  }
  return `[${count} Contributors]`;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function sumEntryObligationsForCustomer(
  entry: NotebookEntryDTO,
  customerId: string
): number {
  return getLedgerObligations(entry)
    .filter((obligation) => obligation.customerId === customerId)
    .reduce((sum, obligation) => sum + obligation.amount, 0);
}
