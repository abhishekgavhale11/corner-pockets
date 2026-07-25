import BusinessDay from "@/models/BusinessDay";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { nextBusinessDayNumberFromDb } from "@/lib/business-day/queries";
import type { BusinessDayDTO } from "@/types";

export async function openBusinessDay(input: {
  businessDate: Date;
  openingCash: number;
  openedBy: string;
}): Promise<BusinessDayDTO> {
  const existingOpen = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (existingOpen) {
    throw new Error(
      "A Business Day is already OPEN. Close it before opening a new one."
    );
  }

  const businessDayNumber = await nextBusinessDayNumberFromDb();
  const openedAt = new Date();

  const [day] = await BusinessDay.create([
    {
      businessDayNumber,
      businessDate: input.businessDate,
      status: "OPEN",
      openedAt,
      openedBy: input.openedBy,
      openingCash: input.openingCash,
    },
  ]);

  return toBusinessDayDTO(day);
}
