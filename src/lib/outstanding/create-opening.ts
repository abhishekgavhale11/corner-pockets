import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import Customer from "@/models/Customer";
import {
  OPENING_OUTSTANDING_INELIGIBLE_MESSAGE,
  assertCustomerEligibleForOpeningOutstanding,
} from "@/lib/outstanding/opening-eligibility";
import { nextOutstandingNumberFromDb } from "@/lib/outstanding/queries";
import { resolveBusinessDate } from "@/lib/utils/business-date";

export type CreateOpeningOutstandingInput = {
  customerId: string;
  amount: number;
  reason?: string;
  effectiveDate?: Date;
  createdBy: string;
};

export type CreateOpeningOutstandingResult = {
  outstandingId: string;
  outstandingNumber: number;
  originalAmount: number;
  remainingAmount: number;
};

/**
 * Admin-only migration: one OPENING Outstanding row per brand-new customer.
 * No Business Day, Frame, Cafe Order, or Payment is created.
 * Participates in Current Outstanding + FIFO collection like any PENDING row.
 * Rejected once the customer has any CPOS timeline / financial activity.
 */
export async function createOpeningOutstanding(
  input: CreateOpeningOutstandingInput
): Promise<CreateOpeningOutstandingResult> {
  if (!mongoose.Types.ObjectId.isValid(input.customerId)) {
    throw new Error("Invalid customer.");
  }

  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error("Amount must be a whole number greater than zero.");
  }

  const reason = input.reason?.trim() || undefined;
  if (reason && reason.length > 500) {
    throw new Error("Reason must be 500 characters or fewer.");
  }

  const createdBy = input.createdBy.trim();
  if (!createdBy) {
    throw new Error("Created by is required.");
  }

  const customerObjectId = new mongoose.Types.ObjectId(input.customerId);
  const dbSession = await mongoose.startSession();

  try {
    let result: CreateOpeningOutstandingResult | null = null;

    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(customerObjectId)
        .session(dbSession)
        .select("isActive");
      if (!customer || customer.isActive === false) {
        throw new Error("Customer not found.");
      }

      // Brand-new customers only (no timeline / financial activity).
      await assertCustomerEligibleForOpeningOutstanding(
        input.customerId,
        dbSession
      );

      const outstandingNumber = await nextOutstandingNumberFromDb(dbSession);
      const effectiveDate = input.effectiveDate
        ? resolveBusinessDate(input.effectiveDate, input.effectiveDate)
        : undefined;

      // businessDate supports oldest-outstanding sorting; not a Business Day link.
      const businessDate = effectiveDate ?? new Date();

      const [doc] = await Outstanding.create(
        [
          {
            outstandingNumber,
            customerId: customerObjectId,
            sourceType: "OPENING",
            originalAmount: input.amount,
            remainingAmount: input.amount,
            status: "PENDING",
            businessDate,
            reason,
            effectiveDate,
            createdBy,
          },
        ],
        { session: dbSession }
      );

      result = {
        outstandingId: doc._id.toString(),
        outstandingNumber: doc.outstandingNumber,
        originalAmount: doc.originalAmount,
        remainingAmount: doc.remainingAmount,
      };
    });

    if (!result) {
      throw new Error("Failed to create Opening Outstanding.");
    }

    return result;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new Error(OPENING_OUTSTANDING_INELIGIBLE_MESSAGE);
    }
    throw error;
  } finally {
    await dbSession.endSession();
  }
}

export async function customerHasOpeningOutstanding(
  customerId: string
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return false;
  }

  const existing = await Outstanding.findOne({
    customerId: new mongoose.Types.ObjectId(customerId),
    sourceType: "OPENING",
  })
    .select("_id")
    .lean();

  return Boolean(existing);
}
