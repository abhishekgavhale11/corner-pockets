import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import Customer from "@/models/Customer";
import FinancialCorrection from "@/models/FinancialCorrection";
import BusinessDay from "@/models/BusinessDay";
import { getCurrentOpenBusinessDay } from "@/lib/business-day/queries";
import {
  isFinancialCorrectionSection,
  type FinancialCorrectionPaymentMethod,
  type FinancialCorrectionSection,
  type FinancialCorrectionType,
} from "@/lib/constants/financial-corrections";

const FULLY_COLLECTED_MESSAGE =
  "This Business Day's outstanding has already been fully collected. A correction cannot reduce remaining below zero.";

export type PostFinancialCorrectionInput = {
  type: FinancialCorrectionType;
  customerId: string;
  affectedBusinessDayId: string;
  amount: number;
  reason: string;
  createdBy: string;
  section: FinancialCorrectionSection;
  paymentMethod?: FinancialCorrectionPaymentMethod;
};

export type PostFinancialCorrectionResult = {
  correctionId: string;
  remainingAmount: number;
};

/**
 * Insert an append-only FinancialCorrection and reduce remainingAmount on
 * the Outstanding row for the same customer + affected Business Day.
 * Does not write OutstandingCollection or BusinessDayFinalSummary.
 */
export async function postFinancialCorrection(
  input: PostFinancialCorrectionInput
): Promise<PostFinancialCorrectionResult> {
  if (!mongoose.Types.ObjectId.isValid(input.customerId)) {
    throw new Error("Invalid customer.");
  }
  if (!mongoose.Types.ObjectId.isValid(input.affectedBusinessDayId)) {
    throw new Error("Invalid Business Day.");
  }
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error("Amount must be a whole number greater than zero.");
  }

  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new Error("Please provide a reason.");
  }

  if (input.type === "MISSED_PAYMENT") {
    if (input.paymentMethod !== "CASH" && input.paymentMethod !== "GPAY") {
      throw new Error("Select Cash or GPay.");
    }
  } else if (input.paymentMethod) {
    throw new Error("Outstanding Correction does not accept a payment mode.");
  }

  if (!isFinancialCorrectionSection(input.section)) {
    throw new Error("Select a section.");
  }

  const customerObjectId = new mongoose.Types.ObjectId(input.customerId);
  const affectedDayId = new mongoose.Types.ObjectId(input.affectedBusinessDayId);
  const openDay = await getCurrentOpenBusinessDay();
  const recordedDayId =
    openDay && openDay.id !== input.affectedBusinessDayId
      ? new mongoose.Types.ObjectId(openDay.id)
      : undefined;

  const dbSession = await mongoose.startSession();

  try {
    let result: PostFinancialCorrectionResult | null = null;

    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(customerObjectId)
        .session(dbSession)
        .select("isActive");
      if (!customer || customer.isActive === false) {
        throw new Error("Customer not found.");
      }

      const affectedDay = await BusinessDay.findById(affectedDayId)
        .session(dbSession)
        .select("status");
      if (!affectedDay) {
        throw new Error("Business Day not found.");
      }
      if (affectedDay.status !== "CLOSED") {
        throw new Error("Corrections can only be applied to a closed Business Day.");
      }

      const outstanding = await Outstanding.findOne({
        customerId: customerObjectId,
        businessDayId: affectedDayId,
        sourceType: { $in: ["FRAME", "CAFE"] },
      }).session(dbSession);

      if (!outstanding) {
        throw new Error(
          "This customer has no outstanding from the selected Business Day."
        );
      }

      if (outstanding.remainingAmount <= 0) {
        throw new Error(FULLY_COLLECTED_MESSAGE);
      }

      if (input.amount > outstanding.remainingAmount) {
        throw new Error(
          `Amount cannot exceed remaining outstanding of ${outstanding.remainingAmount} for this Business Day.`
        );
      }

      const [correction] = await FinancialCorrection.create(
        [
          {
            type: input.type,
            customerId: customerObjectId,
            affectedBusinessDayId: affectedDayId,
            ...(recordedDayId ? { recordedOnBusinessDayId: recordedDayId } : {}),
            amount: input.amount,
            paymentMethod:
              input.type === "MISSED_PAYMENT" ? input.paymentMethod : undefined,
            section: input.section,
            reason,
            createdBy: input.createdBy,
          },
        ],
        { session: dbSession }
      );

      outstanding.remainingAmount -= input.amount;
      if (outstanding.remainingAmount === 0) {
        outstanding.status = "COLLECTED";
        outstanding.collectedAt = new Date();
        if (input.type === "MISSED_PAYMENT" && input.paymentMethod) {
          outstanding.paymentMethod = input.paymentMethod;
        }
      }
      await outstanding.save({ session: dbSession });

      result = {
        correctionId: correction._id.toString(),
        remainingAmount: outstanding.remainingAmount,
      };
    });

    if (!result) {
      throw new Error("Failed to record correction.");
    }

    return result;
  } finally {
    dbSession.endSession();
  }
}
