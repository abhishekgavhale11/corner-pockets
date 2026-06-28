import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import type { INotebookEntry } from "@/models/NotebookEntry";
import {
  ensureActiveVisitBill,
  type VisitBillStaff,
} from "@/lib/visit-bill/ensure-visit-bill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { getBusinessDate } from "@/lib/utils/business-date";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { linkSplitEntryToContributorVisits } from "@/lib/visit-bill/link-split-entry";

export async function linkEntryToActiveVisitBill(
  entry: INotebookEntry,
  staff: VisitBillStaff,
  options?: { dbSession?: ClientSession }
): Promise<void> {
  if (entry.status === "CANCELLED") {
    return;
  }

  if (entryHasContributors(entry)) {
    await linkSplitEntryToContributorVisits(entry, staff, options);
    return;
  }

  if (!entry.customerId) {
    return;
  }

  if (entry.billId && entry.visitId) {
    await syncBillTotals(entry.billId, options?.dbSession);
    return;
  }

  const businessDate = getBusinessDate(entry.createdAt);
  const { visit, bill } = await ensureActiveVisitBill(
    entry.customerId,
    staff,
    { businessDate, dbSession: options?.dbSession }
  );

  entry.visitId = visit._id;
  entry.billId = bill._id;
  await entry.save({ session: options?.dbSession });
  await syncBillTotals(bill._id, options?.dbSession);
}

export async function linkEntriesToActiveVisitBill(
  entries: INotebookEntry[],
  staff: VisitBillStaff,
  options?: { dbSession?: ClientSession }
): Promise<void> {
  const billIds = new Set<string>();

  for (const entry of entries) {
    await linkEntryToActiveVisitBill(entry, staff, options);
    if (entryHasContributors(entry)) {
      for (const contributor of entry.contributors) {
        if (contributor.billId) {
          billIds.add(contributor.billId.toString());
        }
      }
    } else if (entry.billId) {
      billIds.add(entry.billId.toString());
    }
  }

  for (const billId of billIds) {
    await syncBillTotals(new mongoose.Types.ObjectId(billId), options?.dbSession);
  }
}
