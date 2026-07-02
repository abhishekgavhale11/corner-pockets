export const ENTRY_LOCKED_MESSAGE =
  "This item was locked when a payment was received. Use reversal/adjustment to correct it.";

export const ENTRY_LOCKED_TOOLTIP =
  "Locked after payment — use reversal/adjustment to correct";

export function isEntryLockedByPayment(
  entryCreatedAt: Date | string,
  lastPaymentAt?: Date | string | null
): boolean {
  if (!lastPaymentAt) {
    return false;
  }
  return (
    new Date(entryCreatedAt).getTime() < new Date(lastPaymentAt).getTime()
  );
}

export function entryReceivedPayment(input: {
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
}): boolean {
  return (
    (input.paidAmount ?? 0) + (input.balanceCollectedAmount ?? 0) > 0
  );
}

/** Client-safe: derive whether an entry line should be treated as edit-locked. */
export function isNotebookEntryEditLocked(input: {
  status: string;
  createdAt: string;
  billId?: string;
  paidAmount?: number;
  balanceCollectedAmount?: number;
  lastPaymentAt?: string | null;
  isLocked?: boolean;
}): boolean {
  if (input.status === "PAID") {
    return true;
  }

  if (entryReceivedPayment(input)) {
    return true;
  }

  if (input.isLocked) {
    return true;
  }

  if (input.billId && input.lastPaymentAt) {
    return isEntryLockedByPayment(input.createdAt, input.lastPaymentAt);
  }

  return false;
}
