import type { NotebookEntryDTO } from "@/types";
import {
  contributorAmountRemaining,
  entryAmountRemaining,
  entryHasContributors,
} from "@/lib/utils/entry-contributors";

export type CustomerBillSlice = {
  lineTotal: number;
  paid: number;
  due: number;
};

function contributorDueAmount(
  entry: Pick<NotebookEntryDTO, "checkoutDismissedAt">,
  contributor: NonNullable<NotebookEntryDTO["contributors"]>[number]
): number {
  if (
    entry.checkoutDismissedAt &&
    contributor.counterBalanceAmount != null
  ) {
    return contributor.counterBalanceAmount;
  }
  return contributorAmountRemaining(contributor);
}

/** Per-customer share of a notebook line (single-customer or split contributor). */
export function getCustomerBillSlice(
  entry: NotebookEntryDTO,
  customerId: string
): CustomerBillSlice | null {
  if (entryHasContributors(entry)) {
    const contributor = entry.contributors!.find(
      (row) => row.customerId === customerId
    );
    if (!contributor) {
      return null;
    }
    const due = contributorDueAmount(entry, contributor);
    const paid = Math.max(0, contributor.amount - due);
    return {
      lineTotal: contributor.amount,
      paid,
      due,
    };
  }

  if (entry.customerId !== customerId) {
    return null;
  }

  const due = entryAmountRemaining(entry);
  return {
    lineTotal: entry.amount,
    paid: Math.max(0, entry.amount - due),
    due,
  };
}

export function entryBelongsToCustomerBill(
  entry: Pick<
    NotebookEntryDTO,
    "customerId" | "billId" | "contributors"
  >,
  customerId: string,
  billId: string
): boolean {
  if (entryHasContributors(entry)) {
    return entry.contributors!.some(
      (row) =>
        row.customerId === customerId && row.billId === billId
    );
  }
  return entry.customerId === customerId && entry.billId === billId;
}
