export const ENTRY_LOCKED_MESSAGE =
  "This item was locked when a payment was received. Use reversal/adjustment to correct it.";

export const ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE =
  "Paid frames cannot be reassigned. Changing the customer after payment would break payment allocation and ledger history. Use reversal/adjustment instead.";

export const ENTRY_LOCKED_TOOLTIP =
  "Locked after payment — use reversal/adjustment to correct";

export function entryReceivedPayment(input: {
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
}): boolean {
  return (
    (input.paidAmount ?? 0) + (input.balanceCollectedAmount ?? 0) > 0
  );
}

type EntryReassignmentInput = {
  status: string;
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
  contributors?: Array<{
    status?: string;
    paidAmount?: number | null;
    balanceCollectedAmount?: number | null;
  }>;
};

/** Block changing customer / split ownership after any payment on the frame. */
export function entryBlocksCustomerReassignment(
  entry: EntryReassignmentInput
): boolean {
  if (entry.status === "PAID") {
    return true;
  }
  if (entryReceivedPayment(entry)) {
    return true;
  }
  return (
    entry.contributors?.some(
      (contributor) =>
        contributor.status === "PAID" || entryReceivedPayment(contributor)
    ) ?? false
  );
}

type EntryEditLockInput = {
  status: string;
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
  contributors?: Array<{
    status?: string;
    paidAmount?: number | null;
    balanceCollectedAmount?: number | null;
  }>;
};

/**
 * Lock editing when this row (or a split contributor on the same frame) has
 * received payment allocation. Unpaid rows on the same visit stay editable.
 */
export function isNotebookEntryEditLocked(input: EntryEditLockInput): boolean {
  if (input.status === "PAID") {
    return true;
  }

  if (entryReceivedPayment(input)) {
    return true;
  }

  return (
    input.contributors?.some(
      (contributor) =>
        contributor.status === "PAID" || entryReceivedPayment(contributor)
    ) ?? false
  );
}
