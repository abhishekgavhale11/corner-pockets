import mongoose from "mongoose";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";
import type { INotebookEntry } from "@/models/NotebookEntry";
import {
  ensureCounterPaySnapshot,
} from "@/lib/utils/freeze-counter-pay-snapshot";

function splitAllocationsForEntry(
  payments: {
    createdAt: Date;
    allocations: { entryId: mongoose.Types.ObjectId; amount: number }[];
  }[],
  entryId: string,
  dismissedAt: Date
): { checkoutPaid: number; ledgerCollected: number } {
  let checkoutPaid = 0;
  let ledgerCollected = 0;

  for (const payment of payments) {
    for (const allocation of payment.allocations) {
      if (allocation.entryId.toString() !== entryId) {
        continue;
      }
      if (payment.createdAt < dismissedAt) {
        checkoutPaid += allocation.amount;
      } else {
        ledgerCollected += allocation.amount;
      }
    }
  }

  return { checkoutPaid, ledgerCollected };
}

/** Align paidAmount vs balanceCollectedAmount with when payments were recorded. */
export async function reconcileEntryPaymentFields(
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return;

  const objectIds = entryIds.map((id) => new mongoose.Types.ObjectId(id));

  const payments = await CustomerBalancePayment.find({
    "allocations.entryId": { $in: objectIds },
  }).lean();

  const entries = await NotebookEntry.find({ _id: { $in: objectIds } });
  const toSave: INotebookEntry[] = [];

  for (const entry of entries) {
    const entryId = entry._id.toString();

    if (!entry.checkoutDismissedAt) {
      continue;
    }

    const { checkoutPaid, ledgerCollected } = splitAllocationsForEntry(
      payments,
      entryId,
      entry.checkoutDismissedAt
    );

    const nextPaid = checkoutPaid;
    const nextLedger = ledgerCollected;
    const currentPaid = entry.paidAmount ?? 0;
    const currentLedger = entry.balanceCollectedAmount ?? 0;

    if (currentPaid === nextPaid && currentLedger === nextLedger) {
      continue;
    }

    entry.paidAmount = nextPaid;
    entry.balanceCollectedAmount = nextLedger;
    toSave.push(entry);
  }

  await Promise.all(toSave.map((entry) => entry.save()));
}

export async function repairCounterSnapshotsForEntries(
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) {
    return;
  }

  const objectIds = entryIds.map((id) => new mongoose.Types.ObjectId(id));
  const payments = await CustomerBalancePayment.find({
    "allocations.entryId": { $in: objectIds },
  }).lean();

  const entries = await NotebookEntry.find({ _id: { $in: objectIds } });
  const toSave: INotebookEntry[] = [];

  for (const entry of entries) {
    let changed = false;
    if (
      entry.checkoutDismissedAt &&
      ensureCounterPaySnapshot(entry, payments)
    ) {
      changed = true;
    }
    if (entry.checkoutDismissedAt && entry.paymentMethod) {
      entry.paymentMethod = undefined;
      changed = true;
    }
    if (changed) {
      toSave.push(entry);
    }
  }

  await Promise.all(toSave.map((entry) => entry.save()));
}

export async function reconcileCustomerPaymentFields(
  customerId: string
): Promise<void> {
  const entries = await NotebookEntry.find({
    checkoutDismissedAt: { $exists: true, $ne: null },
    $or: [{ customerId }, { "contributors.customerId": customerId }],
  })
    .select("_id")
    .lean();

  await reconcileEntryPaymentFields(entries.map((entry) => entry._id.toString()));
}
