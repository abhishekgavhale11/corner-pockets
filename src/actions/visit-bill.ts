"use server";

import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCustomerFinancials } from "@/lib/utils/revalidate-counter";
import { finishVisitSchema } from "@/lib/validators/visit-bill";
import { finalizeActiveVisitForCustomer } from "@/lib/visit-bill/finalize-visit";
import { enrichEntryDTOWithEditLock } from "@/lib/visit-bill/entry-edit-lock";
import { getFinishedBillIdSet, collectBillIdsFromEntryDtos } from "@/lib/visit-bill/finished-visit-lock";
import { getBusinessDate } from "@/lib/utils/business-date";
import { backfillVisitBillsForCustomer } from "@/lib/visit-bill/backfill";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import { toActiveVisitBillDTO } from "@/lib/mappers/visit-bill";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCustomerBillSlice } from "@/lib/visit-bill/customer-bill-slice";
import type { ActiveVisitBillDTO, CustomerPendingItemDTO, CustomerVisitGlanceDTO, NotebookSettlementDTO } from "@/types";
import Bill from "@/models/Bill";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import Visit from "@/models/Visit";
import { toNotebookSettlementDTO } from "@/lib/mappers/notebook";
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
  const finishedBillIds = await getFinishedBillIdSet(
    collectBillIdsFromEntryDtos(entries.map((entry) => toNotebookEntryDTO(entry)))
  );

  for (const entry of entries) {
    const dto = enrichEntryDTOWithEditLock(
      toNotebookEntryDTO(entry),
      finishedBillIds
    );
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
  }).lean();

  if (!visit) {
    return emptyCustomerVisitGlance(customerId, customerName);
  }

  const bill = await Bill.findById(visit.billId).lean();
  if (!bill) {
    return emptyCustomerVisitGlance(customerId, customerName);
  }

  const synced = await syncBillTotals(bill._id);
  if (!synced) {
    return emptyCustomerVisitGlance(customerId, customerName);
  }

  const items = await getVisitBillDisplayItems(customerId, businessDate);

  return buildCustomerVisitGlance({
    customerId,
    customerName,
    visitStatus: visit.status,
    visitStartedAt: visit.startedAt.toISOString(),
    visitFinishedAt: visit.finishedAt?.toISOString(),
    billTotal: synced.totalAmount,
    paidAmount: synced.paidAmount,
    dueAmount: synced.dueAmount,
    items,
  });
}

export type FinishVisitResult = {
  visitId: string;
  billId: string;
  dueAmount: number;
};

export async function finishVisit(
  formData: FormData
): Promise<ActionResult<FinishVisitResult>> {
  const authResult = await authorizePermission("NOTEBOOK_SETTLE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = finishVisitSchema.safeParse({
    customerId: formData.get("customerId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  try {
    const result = await finalizeActiveVisitForCustomer(
      parsed.data.customerId,
      {
        username: authResult.session.user.username,
        staffId: authResult.session.user.id,
      }
    );

    if (!result) {
      return failure("No active visit found for this customer");
    }

    revalidateCustomerFinancials(parsed.data.customerId);

    return success(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to finish visit";
    return failure(message);
  }
}

export async function getActiveVisitCheckoutSettlements(
  customerId: string
): Promise<NotebookSettlementDTO[]> {
  const authResult = await authorizePermission("NOTEBOOK_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const visit = await Visit.findOne({
    customerId,
    status: "ACTIVE",
  }).lean();

  if (!visit) {
    return [];
  }

  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      { billId: visit.billId, customerId },
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
    .select("_id")
    .lean();

  const entryIds = entries.map((entry) => entry._id);
  if (entryIds.length === 0) {
    return [];
  }

  const settlements = await NotebookSettlement.find({
    status: "COMPLETED",
    entryIds: { $in: entryIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  return settlements.map((settlement) => toNotebookSettlementDTO(settlement));
}
