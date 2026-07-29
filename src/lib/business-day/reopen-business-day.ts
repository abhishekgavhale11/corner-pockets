import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import Outstanding from "@/models/Outstanding";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { deleteBusinessDayFinalSummary } from "@/lib/financial-summary";
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

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const locked = await BusinessDay.findById(input.businessDayId).session(
        session
      );
      if (!locked || locked.status !== "CLOSED") {
        throw new Error("Only a CLOSED Business Day can be reopened.");
      }

      await Outstanding.deleteMany({
        businessDayId: locked._id,
        sourceType: { $in: ["FRAME", "CAFE"] },
      }).session(session);

      await deleteBusinessDayFinalSummary(locked._id, session);

      locked.status = "OPEN";
      locked.closedAt = undefined;
      locked.closedBy = undefined;
      locked.reopenedAt = new Date();
      locked.reopenedBy = input.reopenedBy;
      locked.reopenReason = input.reason.trim();
      await locked.save({ session });
    });
  } finally {
    await session.endSession();
  }

  const reopened = await BusinessDay.findById(input.businessDayId).lean();
  if (!reopened) {
    throw new Error("Business Day not found after reopen.");
  }

  return toBusinessDayDTO(reopened);
}
