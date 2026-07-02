"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { getBusinessDate } from "@/lib/utils/business-date";
import { backfillVisitBillsForCustomer } from "@/lib/visit-bill/backfill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { toActiveVisitBillDTO } from "@/lib/mappers/visit-bill";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";
import type { ActiveVisitBillDTO, CustomerPendingItemDTO, CustomerVisitGlanceDTO } from "@/types";
import Bill from "@/models/Bill";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import Visit from "@/models/Visit";
import {
  buildCustomerVisitGlance,
  emptyCustomerVisitGlance,
} from "@/lib/utils/customer-visit-glance";
import { getCheckoutQueueObligations } from "@/lib/utils/entry-contributors";

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

    for (const obligation of getCheckoutQueueObligations(dto)) {
      if (obligation.customerId !== customerId || obligation.amount <= 0) {
        continue;
      }

      items.push({
        entry: dto,
        contributionAmount: obligation.amount,
        contributorCustomerId: customerId,
        lineAmount: slice?.lineTotal,
        linePaidAmount: slice?.paid,
      });
    }
  }

  return items;
}

/** All visit bill lines for display (includes pay-later balances). */
export async function getVisitBillDisplayItems(
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

export async function getCustomerVisitGlance(
  customerId: string,
  businessDate?: string
): Promise<CustomerVisitGlanceDTO> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return emptyCustomerVisitGlance(customerId, "Customer");
  }

  await connectDB();

  const customer = await Customer.findById(customerId).lean();
  const customerName = customer?.name ?? "Customer";

  const visitBill = await getActiveVisitBillForCustomer(customerId, businessDate);
  if (!visitBill) {
    return emptyCustomerVisitGlance(customerId, customerName);
  }

  const items = await getVisitBillDisplayItems(customerId, businessDate);

  return buildCustomerVisitGlance({
    customerId,
    customerName,
    visitStartedAt: visitBill.visit.startedAt,
    billTotal: visitBill.bill.totalAmount,
    paidAmount: visitBill.bill.paidAmount,
    dueAmount: visitBill.bill.dueAmount,
    items,
  });
}
