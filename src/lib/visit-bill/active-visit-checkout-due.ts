import mongoose from "mongoose";
import { getBusinessDate } from "@/lib/utils/business-date";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCheckoutQueueObligations } from "@/lib/utils/entry-contributors";
import NotebookEntry from "@/models/NotebookEntry";
import Visit from "@/models/Visit";

/** Amount still owed on today's active visit checkout queue (excludes pay-later). */
export async function getActiveVisitCheckoutDueAmount(
  customerId: string,
  businessDate?: string
): Promise<number> {
  const date = businessDate ?? getBusinessDate();

  const visit = await Visit.findOne({
    customerId,
    businessDate: date,
    status: "ACTIVE",
  }).lean();

  if (!visit?.billId) {
    return 0;
  }

  const billId = visit.billId;

  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      {
        billId,
        customerId,
        $or: [
          { contributors: { $exists: false } },
          { contributors: { $size: 0 } },
        ],
      },
      {
        contributors: {
          $elemMatch: {
            customerId: new mongoose.Types.ObjectId(customerId),
            billId,
          },
        },
      },
    ],
  }).lean();

  let checkoutDue = 0;
  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    for (const obligation of getCheckoutQueueObligations(dto)) {
      if (obligation.customerId !== customerId) continue;
      checkoutDue += obligation.amount;
    }
  }

  return checkoutDue;
}
