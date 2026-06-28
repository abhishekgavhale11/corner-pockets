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

/** Attach each contributor's share to that customer's active visit bill. */
export async function linkSplitEntryToContributorVisits(
  entry: INotebookEntry,
  staff: VisitBillStaff,
  options?: { dbSession?: ClientSession }
): Promise<void> {
  if (!entryHasContributors(entry) || entry.status === "CANCELLED") {
    return;
  }

  const businessDate = getBusinessDate(entry.createdAt);
  const billIds = new Set<string>();

  entry.visitId = undefined;
  entry.billId = undefined;

  for (const contributor of entry.contributors) {
    const { visit, bill } = await ensureActiveVisitBill(
      contributor.customerId,
      staff,
      { businessDate, dbSession: options?.dbSession }
    );
    contributor.visitId = visit._id;
    contributor.billId = bill._id;
    billIds.add(bill._id.toString());
  }

  entry.markModified("contributors");
  await entry.save({ session: options?.dbSession });

  for (const billId of billIds) {
    await syncBillTotals(new mongoose.Types.ObjectId(billId), options?.dbSession);
  }
}
