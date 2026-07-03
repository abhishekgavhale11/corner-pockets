import mongoose from "mongoose";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { CUSTOMER_PAGE_PAYMENT_BLOCK_MESSAGE } from "@/lib/constants/customer-page-payments";
import { getBusinessDate } from "@/lib/utils/business-date";
import { toNotebookEntryDTO } from "@/lib/mappers/notebook";
import { getCheckoutQueueObligations } from "@/lib/utils/entry-contributors";
import NotebookEntry from "@/models/NotebookEntry";
import Visit from "@/models/Visit";

export { CUSTOMER_PAGE_PAYMENT_BLOCK_MESSAGE } from "@/lib/constants/customer-page-payments";

/** Checkout-queue due for a customer (same basis as checkout customer tabs). */
export async function getCustomerCheckoutQueueDueAmount(
  customerId: string
): Promise<number> {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);
  const entries = await NotebookEntry.find({
    status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
    $or: [
      { customerId: customerObjectId },
      { "contributors.customerId": customerObjectId },
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

/**
 * Due that blocks Customer Page outstanding collection.
 * Uses visit-bill scope and checkout-queue scope so UI and server stay aligned.
 */
export async function getCustomerPagePaymentBlockDue(
  customerId: string,
  businessDate?: string
): Promise<number> {
  const [visitDue, queueDue] = await Promise.all([
    getActiveVisitCheckoutDueAmount(customerId, businessDate),
    getCustomerCheckoutQueueDueAmount(customerId),
  ]);
  return Math.max(visitDue, queueDue);
}

export async function customerPagePaymentIsBlocked(
  customerId: string,
  businessDate?: string
): Promise<boolean> {
  return (await getCustomerPagePaymentBlockDue(customerId, businessDate)) > 0;
}
