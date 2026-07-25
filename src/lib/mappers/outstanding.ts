import type { IOutstanding } from "@/models/Outstanding";
import type { CustomerOutstandingItemDTO } from "@/types";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import { formatOutstandingPublicId } from "@/lib/outstanding/format";

type OutstandingLean = Pick<
  IOutstanding,
  | "_id"
  | "outstandingNumber"
  | "customerId"
  | "businessDayId"
  | "businessDate"
  | "sourceType"
  | "sourceRecordId"
  | "originalAmount"
  | "remainingAmount"
  | "status"
  | "collectedAt"
  | "paymentMethod"
  | "createdAt"
> & {
  businessDayNumber?: number;
};

export function toCustomerOutstandingItemDTO(
  record: OutstandingLean,
  businessDayNumber: number
): CustomerOutstandingItemDTO {
  return {
    id: record._id.toString(),
    publicId: formatOutstandingPublicId(record.outstandingNumber),
    customerId: record.customerId.toString(),
    businessDayId: record.businessDayId.toString(),
    businessDayPublicId: formatBusinessDayPublicId(businessDayNumber),
    businessDate: record.businessDate.toISOString(),
    sourceType: record.sourceType,
    sourceRecordId: record.sourceRecordId.toString(),
    originalAmount: record.originalAmount,
    remainingAmount: record.remainingAmount,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    collectedAt: record.collectedAt?.toISOString() ?? null,
    paymentMethod: record.paymentMethod ?? null,
  };
}
