import mongoose from "mongoose";
import { getBusinessDate, getBusinessDayBounds } from "@/lib/utils/business-date";
import {
  ensureActiveVisitBill,
  type VisitBillStaff,
} from "@/lib/visit-bill/ensure-visit-bill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { linkSplitEntryToContributorVisits } from "@/lib/visit-bill/link-split-entry";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import NotebookEntry from "@/models/NotebookEntry";

/** Non-destructive backfill for entries that pre-date visit/bill linking. */
export async function backfillVisitBillsForCustomer(
  customerId: string,
  staff: VisitBillStaff,
  businessDate?: string
): Promise<{ linkedCount: number }> {
  const date = businessDate ?? getBusinessDate();
  const { start, end } = getBusinessDayBounds(date);
  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  const singleCustomerEntries = await NotebookEntry.find({
    customerId: customerObjectId,
    status: { $ne: "CANCELLED" },
    createdAt: { $gte: start, $lte: end },
    $or: [{ billId: { $exists: false } }, { billId: null }],
    $and: [
      {
        $or: [
          { contributors: { $exists: false } },
          { contributors: { $size: 0 } },
        ],
      },
    ],
  }).sort({ createdAt: 1 });

  const splitEntries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    createdAt: { $gte: start, $lte: end },
    contributors: { $exists: true, $not: { $size: 0 } },
    $or: [
      { "contributors.customerId": customerObjectId },
      { billId: { $exists: true, $ne: null } },
    ],
  }).sort({ createdAt: 1 });

  const billIds = new Set<string>();
  let linkedCount = 0;

  if (singleCustomerEntries.length > 0) {
    const { visit, bill } = await ensureActiveVisitBill(customerId, staff, {
      businessDate: date,
    });

    for (const entry of singleCustomerEntries) {
      if (entry.billId || entryHasContributors(entry)) {
        continue;
      }
      entry.billId = bill._id;
      entry.visitId = visit._id;
      await entry.save();
      linkedCount += 1;
    }

    billIds.add(bill._id.toString());
  }

  for (const entry of splitEntries) {
    const needsLink =
      entry.billId != null ||
      entry.contributors.some(
        (row) =>
          row.customerId.toString() === customerId &&
          (row.billId == null || !row.billId)
      );
    if (!needsLink) {
      continue;
    }
    await linkSplitEntryToContributorVisits(entry, staff);
    for (const row of entry.contributors) {
      if (row.billId) {
        billIds.add(row.billId.toString());
      }
    }
    linkedCount += 1;
  }

  for (const billId of billIds) {
    await syncBillTotals(new mongoose.Types.ObjectId(billId));
  }

  return { linkedCount };
}
