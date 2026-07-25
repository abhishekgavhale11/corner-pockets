import type { Types } from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import { resolveBusinessDate } from "@/lib/utils/business-date";

export const NO_OPEN_BUSINESS_DAY_MESSAGE =
  "No OPEN Business Day. Start the Business Day before creating operational records.";

export type OpenBusinessDayContext = {
  businessDayId: Types.ObjectId;
  businessDate: Date;
};

/**
 * Returns the current OPEN Business Day id + businessDate.
 * Throws if none is open — used by operational record writers.
 */
export async function requireOpenBusinessDayContext(): Promise<OpenBusinessDayContext> {
  const day = await BusinessDay.findOne({ status: "OPEN" })
    .select("_id businessDate openedAt")
    .lean();
  if (!day) {
    throw new Error(NO_OPEN_BUSINESS_DAY_MESSAGE);
  }
  return {
    businessDayId: day._id as Types.ObjectId,
    businessDate: resolveBusinessDate(day.businessDate, day.openedAt),
  };
}

/** @deprecated Prefer requireOpenBusinessDayContext when businessDate is needed. */
export async function requireOpenBusinessDayObjectId(): Promise<Types.ObjectId> {
  const ctx = await requireOpenBusinessDayContext();
  return ctx.businessDayId;
}

/** Returns OPEN Business Day context, or null if none is open. */
export async function getOpenBusinessDayContext(): Promise<OpenBusinessDayContext | null> {
  const day = await BusinessDay.findOne({ status: "OPEN" })
    .select("_id businessDate openedAt")
    .lean();
  if (!day) return null;
  return {
    businessDayId: day._id as Types.ObjectId,
    businessDate: resolveBusinessDate(day.businessDate, day.openedAt),
  };
}
