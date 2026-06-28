import type { ClientSession } from "mongoose";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import {
  contributorAmountRemaining,
  entryAmountRemaining,
  entryHasContributors,
} from "@/lib/utils/entry-contributors";
import type { INotebookEntry } from "@/models/NotebookEntry";

export type BalancePaymentAllocation = {
  entryId: string;
  amount: number;
};

export type ApplyBalancePaymentResult = {
  allocations: BalancePaymentAllocation[];
  appliedAmount: number;
};

function entryTotalSettled(entry: INotebookEntry): number {
  return (entry.paidAmount ?? 0) + (entry.balanceCollectedAmount ?? 0);
}

function contributorTotalSettled(
  contributor: INotebookEntry["contributors"][number]
): number {
  return (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0);
}

function applyPaymentToEntry(
  entry: INotebookEntry,
  applied: number,
  paymentMethod: NotebookPaymentMethod,
  paidAt: Date
) {
  entry.balanceCollectedAmount = (entry.balanceCollectedAmount ?? 0) + applied;

  if (entryTotalSettled(entry) >= entry.amount) {
    entry.status = "PAID";
  }
}

function applyPaymentToContributor(
  contributor: INotebookEntry["contributors"][number],
  entry: INotebookEntry,
  applied: number,
  paymentMethod: NotebookPaymentMethod,
  paidAt: Date
) {
  contributor.balanceCollectedAmount =
    (contributor.balanceCollectedAmount ?? 0) + applied;

  if (contributorTotalSettled(contributor) >= contributor.amount) {
    contributor.status = "PAID";
    contributor.paidAt = paidAt;
  }

  if (entry.contributors.every((row) => row.status === "PAID")) {
    entry.status = "PAID";
  }
}

export function applyBalancePaymentFifo(
  entries: INotebookEntry[],
  customerId: string,
  paymentAmount: number,
  paymentMethod: NotebookPaymentMethod,
  paidAt: Date
): ApplyBalancePaymentResult {
  const sorted = [...entries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  let remaining = Math.round(paymentAmount);
  const allocations: BalancePaymentAllocation[] = [];

  for (const entry of sorted) {
    if (remaining <= 0) break;

    if (!entry.checkoutDismissedAt) {
      continue;
    }

    if (entryHasContributors({ contributors: entry.contributors })) {
      const contributor = entry.contributors.find(
        (row) => row.customerId.toString() === customerId
      );
      if (!contributor) continue;

      const owed = contributorAmountRemaining(contributor);
      if (owed <= 0) continue;

      const applied = Math.min(remaining, owed);
      applyPaymentToContributor(contributor, entry, applied, paymentMethod, paidAt);

      remaining -= applied;
      allocations.push({
        entryId: entry._id.toString(),
        amount: applied,
      });
      continue;
    }

    if (entry.customerId?.toString() !== customerId) {
      continue;
    }

    const owed = entryAmountRemaining(entry);
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    applyPaymentToEntry(entry, applied, paymentMethod, paidAt);

    remaining -= applied;
    allocations.push({
      entryId: entry._id.toString(),
      amount: applied,
    });
  }

  const appliedAmount = allocations.reduce((sum, row) => sum + row.amount, 0);
  return { allocations, appliedAmount };
}

export async function saveBalancePaymentEntries(
  entries: INotebookEntry[],
  dbSession: ClientSession
) {
  for (const entry of entries) {
    await entry.save({ session: dbSession });
  }
}
