import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import type { INotebookEntry } from "@/models/NotebookEntry";
import Bill from "@/models/Bill";
import {
  ensureActiveVisitBill,
  type VisitBillStaff,
} from "@/lib/visit-bill/ensure-visit-bill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { getBusinessDate } from "@/lib/utils/business-date";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { linkSplitEntryToContributorVisits } from "@/lib/visit-bill/link-split-entry";

export function collectEntryBillIds(entry: INotebookEntry): string[] {
  const billIds = new Set<string>();

  if (entry.billId) {
    billIds.add(entry.billId.toString());
  }

  for (const contributor of entry.contributors ?? []) {
    if (contributor.billId) {
      billIds.add(contributor.billId.toString());
    }
  }

  return [...billIds];
}

async function syncBillIds(
  billIds: Iterable<string>,
  dbSession?: ClientSession
): Promise<void> {
  const unique = [...new Set([...billIds].filter(Boolean))];

  await Promise.all(
    unique.map((billId) =>
      syncBillTotals(new mongoose.Types.ObjectId(billId), dbSession)
    )
  );
}

/**
 * Relink an entry to the correct ACTIVE visit bill(s) after ownership changes,
 * then resync all previously and newly affected bills. — FR-FIN-005
 */
export async function recalculateActiveVisitForEntryOwnership(
  entry: INotebookEntry,
  staff: VisitBillStaff,
  options?: {
    dbSession?: ClientSession;
    priorBillIds?: Iterable<string>;
  }
): Promise<void> {
  if (entry.status === "CANCELLED") {
    return;
  }

  const billsToSync = new Set<string>([
    ...collectEntryBillIds(entry),
    ...[...(options?.priorBillIds ?? [])].map(String).filter(Boolean),
  ]);

  if (entryHasContributors(entry)) {
    await linkSplitEntryToContributorVisits(entry, staff, options);
    for (const billId of collectEntryBillIds(entry)) {
      billsToSync.add(billId);
    }
    await syncBillIds(billsToSync, options?.dbSession);
    return;
  }

  if (!entry.customerId) {
    entry.visitId = undefined;
    entry.billId = undefined;
    await entry.save({ session: options?.dbSession ?? null });
    await syncBillIds(billsToSync, options?.dbSession);
    return;
  }

  const businessDate = getBusinessDate(entry.createdAt);
  const { visit, bill } = await ensureActiveVisitBill(entry.customerId, staff, {
    businessDate,
    dbSession: options?.dbSession,
  });

  entry.visitId = visit._id;
  entry.billId = bill._id;
  await entry.save({ session: options?.dbSession ?? null });
  billsToSync.add(bill._id.toString());
  await syncBillIds(billsToSync, options?.dbSession);
}

/** Returns true when entry bill linkage matches the entry's current owner. */
export async function entryBillOwnershipMatches(
  entry: Pick<INotebookEntry, "customerId" | "billId" | "contributors">,
  dbSession?: ClientSession
): Promise<boolean> {
  if (entryHasContributors(entry)) {
    if (!entry.contributors?.length) {
      return false;
    }

    for (const contributor of entry.contributors) {
      if (!contributor.billId || !contributor.customerId) {
        return false;
      }

      const bill = await Bill.findById(contributor.billId).session(
        dbSession ?? null
      );
      if (
        !bill ||
        bill.customerId.toString() !== contributor.customerId.toString()
      ) {
        return false;
      }
    }

    return true;
  }

  if (!entry.customerId || !entry.billId) {
    return !entry.billId;
  }

  const bill = await Bill.findById(entry.billId).session(dbSession ?? null);
  if (!bill) {
    return false;
  }

  return bill.customerId.toString() === entry.customerId.toString();
}
