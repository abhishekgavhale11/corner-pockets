"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { getBusinessDate } from "@/lib/utils/business-date";
import { backfillVisitBillsForCustomer } from "@/lib/visit-bill/backfill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { toActiveVisitBillDTO } from "@/lib/mappers/visit-bill";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";
import type { ActiveVisitBillDTO, CustomerPendingItemDTO } from "@/types";
import Bill from "@/models/Bill";
import NotebookEntry from "@/models/NotebookEntry";
import Visit from "@/models/Visit";

export async function getActiveVisitBillForCustomer(
  customerId: string,
  businessDate?: string
): Promise<ActiveVisitBillDTO | null> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return null;
  }

  await connectDB();

  const date = businessDate ?? getBusinessDate();

  await backfillVisitBillsForCustomer(
    customerId,
    {
      username: authResult.session.user.username,
      staffId: authResult.session.user.id,
    },
    date
  );

  const visit = await Visit.findOne({
    customerId,
    businessDate: date,
    status: "ACTIVE",
  }).lean();

  if (!visit) {
    return null;
  }

  const bill = await Bill.findById(visit.billId).lean();
  if (!bill) {
    return null;
  }

  const synced = await syncBillTotals(bill._id);
  if (!synced) {
    return null;
  }

  return toActiveVisitBillDTO({ visit, bill: synced });
}

export async function getVisitBillCheckoutItems(
  customerId: string,
  businessDate?: string
): Promise<CustomerPendingItemDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const date = businessDate ?? getBusinessDate();

  await backfillVisitBillsForCustomer(
    customerId,
    {
      username: authResult.session.user.username,
      staffId: authResult.session.user.id,
    },
    date
  );

  const visit = await Visit.findOne({
    customerId,
    businessDate: date,
    status: "ACTIVE",
  }).lean();

  if (!visit) {
    return [];
  }

  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      {
        billId: visit.billId,
        customerId,
        $or: [
          { contributors: { $exists: false } },
          { contributors: { $size: 0 } },
        ],
      },
      {
        contributors: {
          $elemMatch: {
            customerId,
            billId: visit.billId,
          },
        },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  const items: CustomerPendingItemDTO[] = [];

  for (const entry of entries) {
    const dto = toNotebookEntryDTO(entry);
    const slice = getCustomerBillSlice(dto, customerId);
    if (!slice) {
      continue;
    }
    items.push({
      entry: dto,
      contributionAmount: slice.due,
      contributorCustomerId: customerId,
      lineAmount: slice.lineTotal,
      linePaidAmount: slice.paid,
    });
  }

  return items;
}
