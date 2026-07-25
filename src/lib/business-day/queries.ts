import BusinessDay from "@/models/BusinessDay";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { buildBusinessDayCloseSummary } from "@/lib/business-day/close-summary";
import type { BusinessDayClosePreviewDTO, BusinessDayDTO } from "@/types";

export async function getCurrentOpenBusinessDay(): Promise<BusinessDayDTO | null> {
  const day = await BusinessDay.findOne({ status: "OPEN" }).lean();
  return day ? toBusinessDayDTO(day) : null;
}

/** Counter gate: answers only whether an OPEN Business Day exists. */
export async function hasOpenBusinessDay(): Promise<boolean> {
  const day = await BusinessDay.findOne({ status: "OPEN" })
    .select("_id")
    .lean();
  return Boolean(day);
}

export async function getBusinessDayHistory(
  limit = 50
): Promise<BusinessDayDTO[]> {
  const days = await BusinessDay.find()
    .sort({ businessDayNumber: -1 })
    .limit(limit)
    .lean();
  return days.map((day) => toBusinessDayDTO(day));
}

export async function nextBusinessDayNumberFromDb(): Promise<number> {
  const last = await BusinessDay.findOne()
    .sort({ businessDayNumber: -1 })
    .select("businessDayNumber")
    .lean();
  return (last?.businessDayNumber ?? 0) + 1;
}

/** Close confirmation data — Business Day owns the summary; Counter only displays. */
export async function getBusinessDayClosePreview(): Promise<BusinessDayClosePreviewDTO | null> {
  return buildBusinessDayCloseSummary();
}
