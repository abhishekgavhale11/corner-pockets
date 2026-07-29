/**
 * OPEN-day Close Preview — temporary Financial Summary for the active workspace.
 * After Close, screens must read BusinessDayFinalSummary (immutable).
 */
import BusinessDay from "@/models/BusinessDay";
import type {
  BusinessDayCloseCategoryPreviewDTO,
  BusinessDayClosePreviewDTO,
} from "@/types";
import { buildBusinessDayFinalSummaryPayload } from "@/lib/financial-summary/build-final-summary";
import type { Types } from "mongoose";

function toCategory(section: {
  bill: number;
  cashCollection: number;
  gpayCollection: number;
  outstandingCreated: number;
}): BusinessDayCloseCategoryPreviewDTO {
  return {
    revenue: section.bill,
    cashCollection: section.cashCollection,
    gpayCollection: section.gpayCollection,
    outstandingCreated: section.outstandingCreated,
  };
}

/**
 * Builds the Business Day Closing Summary from the Financial Summary Engine.
 * For OPEN days this is a temporary preview; at Close the same engine persists
 * BusinessDayFinalSummary inside the close transaction.
 */
export async function buildBusinessDayCloseSummaryForId(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayClosePreviewDTO | null> {
  const payload = await buildBusinessDayFinalSummaryPayload({
    businessDayId,
    closedAt: new Date(),
  });
  if (!payload) return null;

  return {
    todaysBill: payload.bill,
    totalPaid: payload.paid,
    cashCollection: payload.cashCollection,
    gpayCollection: payload.gpayCollection,
    outstandingAmount: payload.outstandingCreated,
    snooker: toCategory(payload.snooker),
    cafe: toCategory(payload.cafe),
    unassignedFrames: payload.unassignedFrames,
    unassignedCafeItems: payload.unassignedCafeItems,
  };
}

/**
 * Builds the Business Day Closing Summary for the OPEN Business Day.
 */
export async function buildBusinessDayCloseSummary(): Promise<BusinessDayClosePreviewDTO | null> {
  const day = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (!day) {
    return null;
  }

  return buildBusinessDayCloseSummaryForId(day._id);
}
