import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import BusinessDay from "@/models/BusinessDay";
import { formatBusinessDayPublicId } from "@/lib/business-day/format";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import type { FinancialCorrectionEligibleDayDTO } from "@/types";

/**
 * Closed-day Outstanding rows for this customer with remaining > 0.
 * Used to pick the affected Business Day for a correction.
 */
export async function listEligibleCorrectionDays(
  customerId: string
): Promise<FinancialCorrectionEligibleDayDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) return [];

  const rows = await Outstanding.find({
    customerId: new mongoose.Types.ObjectId(customerId),
    sourceType: { $in: ["FRAME", "CAFE"] },
    remainingAmount: { $gt: 0 },
    businessDayId: { $exists: true, $ne: null },
  })
    .select("businessDayId remainingAmount originalAmount")
    .lean();

  if (rows.length === 0) return [];

  const dayIds = [
    ...new Set(
      rows
        .map((row) => row.businessDayId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const days = await BusinessDay.find({
    _id: { $in: dayIds.map((id) => new mongoose.Types.ObjectId(id)) },
    status: "CLOSED",
  })
    .select("_id businessDayNumber businessDate openedAt")
    .lean();

  const dayById = new Map(days.map((day) => [day._id.toString(), day]));
  const remainingByDay = new Map<string, number>();

  for (const row of rows) {
    const dayId = row.businessDayId?.toString();
    if (!dayId || !dayById.has(dayId)) continue;
    remainingByDay.set(
      dayId,
      (remainingByDay.get(dayId) ?? 0) + row.remainingAmount
    );
  }

  return [...remainingByDay.entries()]
    .map(([id, remainingAmount]) => {
      const day = dayById.get(id)!;
      const businessDate = resolveBusinessDate(day.businessDate, day.openedAt);
      return {
        businessDayId: id,
        publicId: formatBusinessDayPublicId(day.businessDayNumber),
        businessDayNumber: day.businessDayNumber,
        businessDate: businessDate.toISOString(),
        remainingAmount,
      };
    })
    .sort((a, b) => b.businessDayNumber - a.businessDayNumber);
}
