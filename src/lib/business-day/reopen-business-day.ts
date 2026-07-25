import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import type { BusinessDayDTO } from "@/types";

export async function reopenBusinessDay(input: {
  businessDayId: string;
  reason: string;
  reopenedBy: string;
}): Promise<BusinessDayDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.businessDayId)) {
    throw new Error("Invalid Business Day.");
  }

  const day = await BusinessDay.findById(input.businessDayId);
  if (!day) {
    throw new Error("Business Day not found.");
  }

  if (day.status !== "CLOSED") {
    throw new Error("Only a CLOSED Business Day can be reopened.");
  }

  const newerOpen = await BusinessDay.findOne({
    status: "OPEN",
    businessDayNumber: { $gt: day.businessDayNumber },
  }).lean();

  if (newerOpen) {
    throw new Error(
      `Cannot reopen Business Day #${day.businessDayNumber} while Business Day #${newerOpen.businessDayNumber} is OPEN. Close the current Business Day first.`
    );
  }

  const anyOpen = await BusinessDay.findOne({ status: "OPEN" }).lean();
  if (anyOpen) {
    throw new Error(
      "A Business Day is already OPEN. Close it before reopening another."
    );
  }

  day.status = "OPEN";
  day.closedAt = undefined;
  day.closedBy = undefined;
  day.reopenedAt = new Date();
  day.reopenedBy = input.reopenedBy;
  day.reopenReason = input.reason.trim();
  await day.save();

  return toBusinessDayDTO(day);
}
