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
  | "reason"
  | "effectiveDate"
  | "createdBy"
> & {
  businessDayNumber?: number;
};

export function toCustomerOutstandingItemDTO(
  record: OutstandingLean,
  businessDayNumber: number | null
): CustomerOutstandingItemDTO {
  const isOpening = record.sourceType === "OPENING";

  return {
    id: record._id.toString(),
    publicId: formatOutstandingPublicId(record.outstandingNumber),
    customerId: record.customerId.toString(),
    businessDayId: record.businessDayId?.toString() ?? null,
    businessDayPublicId:
      !isOpening && businessDayNumber != null && businessDayNumber > 0
        ? formatBusinessDayPublicId(businessDayNumber)
        : null,
    businessDate: record.businessDate?.toISOString() ?? null,
    sourceType: record.sourceType,
    sourceRecordId: record.sourceRecordId?.toString() ?? null,
    originalAmount: record.originalAmount,
    remainingAmount: record.remainingAmount,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    collectedAt: record.collectedAt?.toISOString() ?? null,
    paymentMethod: record.paymentMethod ?? null,
    reason: record.reason ?? null,
    effectiveDate: record.effectiveDate?.toISOString() ?? null,
    createdBy: record.createdBy ?? null,
  };
}
