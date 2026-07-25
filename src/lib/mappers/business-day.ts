import type { IBusinessDay } from "@/models/BusinessDay";
import type { BusinessDayDTO } from "@/types";
import { resolveBusinessDate } from "@/lib/utils/business-date";

export function toBusinessDayDTO(
  day: Pick<
    IBusinessDay,
    | "_id"
    | "businessDayNumber"
    | "businessDate"
    | "status"
    | "openedAt"
    | "openedBy"
    | "closedAt"
    | "closedBy"
    | "openingCash"
    | "reopenedAt"
    | "reopenedBy"
    | "reopenReason"
    | "createdAt"
    | "updatedAt"
  >
): BusinessDayDTO {
  const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);
  return {
    id: day._id.toString(),
    businessDayNumber: day.businessDayNumber,
    status: day.status,
    businessDate: businessDate.toISOString(),
    openedAt: day.openedAt.toISOString(),
    openedBy: day.openedBy,
    closedAt: day.closedAt?.toISOString(),
    closedBy: day.closedBy,
    openingCash: day.openingCash,
    reopenedAt: day.reopenedAt?.toISOString(),
    reopenedBy: day.reopenedBy,
    reopenReason: day.reopenReason,
    createdAt: day.createdAt.toISOString(),
    updatedAt: day.updatedAt.toISOString(),
  };
}
