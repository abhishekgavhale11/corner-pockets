import type { ClientSession, Types } from "mongoose";
import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import BusinessDayFinalSummary, {
  type IBusinessDayFinalSummary,
} from "@/models/BusinessDayFinalSummary";
import {
  buildBusinessDayFinalSummaryPayload,
  type BusinessDayFinalSummaryPayload,
} from "@/lib/financial-summary/build-final-summary";

function toObjectId(id: Types.ObjectId | string): Types.ObjectId {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

export function leanFinalSummaryToPayload(
  doc: IBusinessDayFinalSummary | (IBusinessDayFinalSummary & { _id: Types.ObjectId })
): BusinessDayFinalSummaryPayload {
  return {
    businessDayId: doc.businessDayId.toString(),
    businessDayNumber: doc.businessDayNumber,
    businessDate: doc.businessDate,
    closedAt: doc.closedAt,
    bill: doc.bill,
    paid: doc.paid,
    outstandingCreated: doc.outstandingCreated,
    cashCollection: doc.cashCollection,
    gpayCollection: doc.gpayCollection,
    outstandingCollected: doc.outstandingCollected,
    closingOutstanding: doc.closingOutstanding,
    openingOutstanding: doc.openingOutstanding,
    unassignedFrames: doc.unassignedFrames,
    unassignedCafeItems: doc.unassignedCafeItems,
    snooker: doc.snooker,
    bigSnooker: doc.bigSnooker,
    poolMini: doc.poolMini,
    cafe: doc.cafe,
    customers: doc.customers,
  };
}

/**
 * Persist Final Summary inside the Close transaction.
 * Must never be updated after insert.
 */
export async function insertBusinessDayFinalSummaryInSession(input: {
  payload: BusinessDayFinalSummaryPayload;
  session: ClientSession;
}): Promise<void> {
  const { payload, session } = input;
  const existing = await BusinessDayFinalSummary.countDocuments({
    businessDayId: toObjectId(payload.businessDayId),
  }).session(session);

  if (existing > 0) {
    throw new Error(
      "Business Day Final Summary already exists for this Business Day."
    );
  }

  await BusinessDayFinalSummary.create(
    [
      {
        businessDayId: toObjectId(payload.businessDayId),
        businessDayNumber: payload.businessDayNumber,
        businessDate: payload.businessDate,
        closedAt: payload.closedAt,
        bill: payload.bill,
        paid: payload.paid,
        outstandingCreated: payload.outstandingCreated,
        cashCollection: payload.cashCollection,
        gpayCollection: payload.gpayCollection,
        outstandingCollected: payload.outstandingCollected,
        closingOutstanding: payload.closingOutstanding,
        openingOutstanding: payload.openingOutstanding,
        unassignedFrames: payload.unassignedFrames,
        unassignedCafeItems: payload.unassignedCafeItems,
        snooker: payload.snooker,
        bigSnooker: payload.bigSnooker,
        poolMini: payload.poolMini,
        cafe: payload.cafe,
        customers: payload.customers,
      },
    ],
    { session }
  );
}

export async function deleteBusinessDayFinalSummary(
  businessDayId: Types.ObjectId | string,
  session?: ClientSession
): Promise<void> {
  const query = BusinessDayFinalSummary.deleteOne({
    businessDayId: toObjectId(businessDayId),
  });
  if (session) {
    query.session(session);
  }
  await query;
}

export async function getBusinessDayFinalSummary(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayFinalSummaryPayload | null> {
  const doc = await BusinessDayFinalSummary.findOne({
    businessDayId: toObjectId(businessDayId),
  }).lean();
  if (!doc) return null;
  return leanFinalSummaryToPayload(doc as IBusinessDayFinalSummary);
}

/**
 * Read Final Summary for a CLOSED day. If missing (legacy closed days),
 * build once via the Financial Summary Engine and persist (one-time backfill).
 */
export async function requireBusinessDayFinalSummary(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayFinalSummaryPayload> {
  const existing = await getBusinessDayFinalSummary(businessDayId);
  if (existing) return existing;

  const day = await BusinessDay.findById(businessDayId).lean();
  if (!day || day.status !== "CLOSED" || !day.closedAt) {
    throw new Error("Business Day Final Summary is only available for CLOSED days.");
  }

  const payload = await buildBusinessDayFinalSummaryPayload({
    businessDayId,
    closedAt: day.closedAt,
  });
  if (!payload) {
    throw new Error("Failed to build Business Day Final Summary.");
  }

  try {
    await BusinessDayFinalSummary.create({
      businessDayId: toObjectId(payload.businessDayId),
      businessDayNumber: payload.businessDayNumber,
      businessDate: payload.businessDate,
      closedAt: payload.closedAt,
      bill: payload.bill,
      paid: payload.paid,
      outstandingCreated: payload.outstandingCreated,
      cashCollection: payload.cashCollection,
      gpayCollection: payload.gpayCollection,
      outstandingCollected: payload.outstandingCollected,
      closingOutstanding: payload.closingOutstanding,
      openingOutstanding: payload.openingOutstanding,
      unassignedFrames: payload.unassignedFrames,
      unassignedCafeItems: payload.unassignedCafeItems,
      snooker: payload.snooker,
      bigSnooker: payload.bigSnooker,
      poolMini: payload.poolMini,
      cafe: payload.cafe,
      customers: payload.customers,
    });
  } catch (error) {
    // Race: another request backfilled first.
    const raced = await getBusinessDayFinalSummary(businessDayId);
    if (raced) return raced;
    throw error;
  }

  return payload;
}

export async function listBusinessDayFinalSummaries(
  businessDayIds: Array<Types.ObjectId | string>
): Promise<Map<string, BusinessDayFinalSummaryPayload>> {
  const ids = businessDayIds.map(toObjectId);
  const docs = await BusinessDayFinalSummary.find({
    businessDayId: { $in: ids },
  }).lean();

  const map = new Map<string, BusinessDayFinalSummaryPayload>();
  for (const doc of docs) {
    const payload = leanFinalSummaryToPayload(doc as IBusinessDayFinalSummary);
    map.set(payload.businessDayId, payload);
  }

  // Backfill any missing CLOSED days (legacy).
  for (const id of ids) {
    const key = id.toString();
    if (map.has(key)) continue;
    try {
      const payload = await requireBusinessDayFinalSummary(id);
      map.set(key, payload);
    } catch {
      // Skip days that cannot be summarized.
    }
  }

  return map;
}
