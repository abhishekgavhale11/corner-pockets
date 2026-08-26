import type { Types } from "mongoose";
import mongoose from "mongoose";
import FinancialCorrection from "@/models/FinancialCorrection";
import type { FinancialCorrectionOverlayInput } from "@/lib/financial-summary/apply-corrections";
import {
  isFinancialCorrectionSection,
  type FinancialCorrectionPaymentMethod,
  type FinancialCorrectionSection,
  type FinancialCorrectionType,
} from "@/lib/constants/financial-corrections";

function toObjectId(id: Types.ObjectId | string): Types.ObjectId {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

export type FinancialCorrectionRecord = {
  id: string;
  type: FinancialCorrectionType;
  customerId: string;
  affectedBusinessDayId: string;
  recordedOnBusinessDayId: string | null;
  amount: number;
  paymentMethod: FinancialCorrectionPaymentMethod | null;
  section: FinancialCorrectionSection | null;
  reason: string;
  createdBy: string;
  createdAt: Date;
};

function toRecord(doc: {
  _id: Types.ObjectId;
  type: FinancialCorrectionType;
  customerId: Types.ObjectId;
  affectedBusinessDayId: Types.ObjectId;
  recordedOnBusinessDayId?: Types.ObjectId | null;
  amount: number;
  paymentMethod?: FinancialCorrectionPaymentMethod;
  section?: FinancialCorrectionSection | null;
  reason: string;
  createdBy: string;
  createdAt: Date;
}): FinancialCorrectionRecord {
  return {
    id: doc._id.toString(),
    type: doc.type,
    customerId: doc.customerId.toString(),
    affectedBusinessDayId: doc.affectedBusinessDayId.toString(),
    recordedOnBusinessDayId: doc.recordedOnBusinessDayId
      ? doc.recordedOnBusinessDayId.toString()
      : null,
    amount: doc.amount,
    paymentMethod: doc.paymentMethod ?? null,
    section: isFinancialCorrectionSection(doc.section) ? doc.section : null,
    reason: doc.reason,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

export function toOverlayInput(
  record: FinancialCorrectionRecord
): FinancialCorrectionOverlayInput {
  return {
    type: record.type,
    customerId: record.customerId,
    amount: record.amount,
    paymentMethod: record.paymentMethod,
    section: record.section,
  };
}

export async function listFinancialCorrectionsForAffectedDay(
  businessDayId: Types.ObjectId | string
): Promise<FinancialCorrectionRecord[]> {
  const docs = await FinancialCorrection.find({
    affectedBusinessDayId: toObjectId(businessDayId),
  })
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((doc) => toRecord(doc as typeof docs[0] & { _id: Types.ObjectId }));
}

export async function listFinancialCorrectionsByAffectedDayIds(
  businessDayIds: Array<Types.ObjectId | string>
): Promise<Map<string, FinancialCorrectionRecord[]>> {
  const result = new Map<string, FinancialCorrectionRecord[]>();
  if (businessDayIds.length === 0) return result;

  const ids = businessDayIds.map(toObjectId);
  const docs = await FinancialCorrection.find({
    affectedBusinessDayId: { $in: ids },
  })
    .sort({ createdAt: 1 })
    .lean();

  for (const id of ids) {
    result.set(id.toString(), []);
  }

  for (const doc of docs) {
    const record = toRecord(doc as typeof docs[0] & { _id: Types.ObjectId });
    const list = result.get(record.affectedBusinessDayId) ?? [];
    list.push(record);
    result.set(record.affectedBusinessDayId, list);
  }

  return result;
}

export async function listFinancialCorrectionsForCustomer(
  customerId: string
): Promise<FinancialCorrectionRecord[]> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) return [];

  const docs = await FinancialCorrection.find({
    customerId: new mongoose.Types.ObjectId(customerId),
  })
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((doc) => toRecord(doc as typeof docs[0] & { _id: Types.ObjectId }));
}

export async function sumMissedPaymentsForCustomer(
  customerId: string
): Promise<number> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) return 0;

  const agg = await FinancialCorrection.aggregate<{ total: number }>([
    {
      $match: {
        customerId: new mongoose.Types.ObjectId(customerId),
        type: "MISSED_PAYMENT",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return Math.round(agg[0]?.total ?? 0);
}
