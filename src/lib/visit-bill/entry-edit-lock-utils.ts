import type { VisitStatus } from "@/lib/constants/visit-bill";
export const ENTRY_LOCKED_MESSAGE =
  "This item was locked when a payment was received. Remove the checkout payment to edit it.";

export const ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE =
  "Paid frames cannot be reassigned. Changing the customer after payment would break payment allocation and ledger history.";

export const ENTRY_LOCKED_TOOLTIP =
  "Locked after payment — remove payment in checkout to edit";

export const VISIT_FINISHED_LOCK_MESSAGE =
  "This visit is finished and cannot be edited.";

export const VISIT_FINISHED_CHECKOUT_MESSAGE =
  "This visit is finished. Checkout is no longer available.";

export const VISIT_FINISHED_LOCK_TOOLTIP =
  "Visit finished — read-only for the business day";

export const SPLIT_CONTRIBUTOR_LOCKED_MESSAGE =
  "This contributor has paid or finished their visit and cannot be changed.";

export const FRAME_STRUCTURE_LOCKED_MESSAGE =
  "Frame type, amount, and split amounts are locked after a checkout payment.";

export const FRAME_PARTIAL_LOCK_REASSIGN_HINT =
  "Paid contributors are locked. Unpaid contributors may be reassigned to another customer at the same split amount.";

export function entryReceivedPayment(input: {
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
}): boolean {
  return (
    (input.paidAmount ?? 0) + (input.balanceCollectedAmount ?? 0) > 0
  );
}

export type ContributorLockInput = {
  status?: string;
  visitStatus?: VisitStatus;
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
};

type EntryEditLockInput = {
  status: string;
  visitStatus?: VisitStatus;
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
  contributors?: ContributorLockInput[];
};

type EntryReassignmentInput = EntryEditLockInput;

/** Checkout payment allocated to this contributor — FR-FRM-001 */
export function contributorHasCheckoutPayment(
  contributor: ContributorLockInput
): boolean {
  if (contributor.status === "PAID") {
    return true;
  }
  return entryReceivedPayment(contributor);
}

/** Paid or finished — customer assignment cannot change — FR-FRM-001 */
export function isContributorAssignmentLocked(
  contributor: ContributorLockInput
): boolean {
  if (contributor.visitStatus === "FINISHED") {
    return true;
  }
  return contributorHasCheckoutPayment(contributor);
}

/** Unpaid ACTIVE contributor may be reassigned — FR-FRM-001 */
export function isContributorReassignable(
  contributor: ContributorLockInput
): boolean {
  return !isContributorAssignmentLocked(contributor);
}

/** Any checkout payment on the frame triggers partial lock — FR-FRM-001 */
export function frameHasPartialPaymentLock(entry: EntryEditLockInput): boolean {
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.some((contributor) =>
      contributorHasCheckoutPayment(contributor)
    );
  }

  if (entry.visitStatus === "FINISHED") {
    return true;
  }
  if (entry.status === "PAID") {
    return true;
  }
  return entryReceivedPayment(entry);
}

/** Frame type, amount, and split amounts locked — FR-FRM-001 */
export function isFrameStructureLocked(entry: EntryEditLockInput): boolean {
  if (entry.contributors && entry.contributors.length > 0) {
    return (
      frameHasPartialPaymentLock(entry) ||
      entry.contributors.every(
        (contributor) => contributor.visitStatus === "FINISHED"
      )
    );
  }

  if (entry.visitStatus === "FINISHED") {
    return true;
  }
  if (entry.status === "PAID") {
    return true;
  }
  return entryReceivedPayment(entry);
}

/** Lock a single split contributor when their visit is finished or they have checkout payment. */
export function isContributorEditLocked(contributor: ContributorLockInput): boolean {
  return isContributorAssignmentLocked(contributor);
}

/** Block changing customer / split ownership when every contributor is locked. */
export function entryBlocksCustomerReassignment(
  entry: EntryReassignmentInput
): boolean {
  if (entry.contributors && entry.contributors.length > 0) {
    return entry.contributors.every((contributor) =>
      isContributorEditLocked(contributor)
    );
  }

  if (entry.visitStatus === "FINISHED") {
    return true;
  }
  if (entry.status === "PAID") {
    return true;
  }
  if (entryReceivedPayment(entry)) {
    return true;
  }

  return false;
}

export function splitEntryHasEditableContributor(
  entry: EntryReassignmentInput
): boolean {
  if (!entry.contributors?.length) {
    return false;
  }
  return entry.contributors.some((contributor) =>
    isContributorReassignable(contributor)
  );
}

/** Lock editing when every contributor is locked (or single-entry rules apply). */
export function isNotebookEntryEditLocked(input: EntryEditLockInput): boolean {
  if (input.contributors && input.contributors.length > 0) {
    return input.contributors.every((contributor) =>
      isContributorEditLocked(contributor)
    );
  }

  if (input.visitStatus === "FINISHED") {
    return true;
  }

  if (input.status === "PAID") {
    return true;
  }

  if (entryReceivedPayment(input)) {
    return true;
  }

  return false;
}

export function getEntryLockTooltip(input: {
  visitStatus?: VisitStatus;
}): string {
  if (input.visitStatus === "FINISHED") {
    return VISIT_FINISHED_LOCK_TOOLTIP;
  }
  return ENTRY_LOCKED_TOOLTIP;
}

export function getContributorLockTooltip(input: {
  visitStatus?: VisitStatus;
}): string {
  if (input.visitStatus === "FINISHED") {
    return VISIT_FINISHED_LOCK_TOOLTIP;
  }
  return "Paid — assignment locked";
}
