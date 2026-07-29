import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import BusinessDay from "@/models/BusinessDay";
import { toCustomerOutstandingItemDTO } from "@/lib/mappers/outstanding";
import type { CustomerOutstandingItemDTO } from "@/types";

export async function getCustomerOutstandingHistory(
  customerId: string
): Promise<CustomerOutstandingItemDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return [];
  }

  const records = await Outstanding.find({ customerId })
    .sort({ createdAt: -1 })
    .lean();

  if (records.length === 0) {
    return [];
  }

  const businessDayIds = [
    ...new Set(
      records
        .map((record) => record.businessDayId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const days =
    businessDayIds.length > 0
      ? await BusinessDay.find({
          _id: { $in: businessDayIds },
        })
          .select("_id businessDayNumber")
          .lean()
      : [];

  const dayNumberById = new Map(
    days.map((day) => [day._id.toString(), day.businessDayNumber])
  );

  return records.map((record) => {
    const dayId = record.businessDayId?.toString();
    const businessDayNumber = dayId
      ? (dayNumberById.get(dayId) ?? null)
      : null;
    return toCustomerOutstandingItemDTO(record, businessDayNumber);
  });
}
