import mongoose from "mongoose";
import Outstanding from "@/models/Outstanding";
import OutstandingCollection from "@/models/OutstandingCollection";
import type { OutstandingPaymentMethod } from "@/lib/constants/outstanding";
import Customer from "@/models/Customer";

/**
 * Collect Outstanding with Cash or GPay only.
 * Wallet is not allowed — Wallet may be used only while paying an active bill.
 */
export async function collectOutstandingForCustomer(input: {
  customerId: string;
  receivedAmount: number;
  paymentMethod: OutstandingPaymentMethod;
  collectedBy: string;
  staffId: string;
}): Promise<{ remainingBalance: number; collectionId: string }> {
  if (!mongoose.Types.ObjectId.isValid(input.customerId)) {
    throw new Error("Invalid customer.");
  }

  if (input.receivedAmount <= 0) {
    throw new Error("Received amount must be greater than zero.");
  }

  if (input.paymentMethod !== "CASH" && input.paymentMethod !== "GPAY") {
    throw new Error(
      "Outstanding Collection accepts Cash or GPay only. Wallet may be used only while paying an active bill."
    );
  }

  const customerObjectId = new mongoose.Types.ObjectId(input.customerId);
  const dbSession = await mongoose.startSession();

  try {
    let remainingBalance = 0;
    let collectionId = "";

    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(customerObjectId)
        .session(dbSession)
        .select("isActive");
      if (!customer || customer.isActive === false) {
        throw new Error("Customer not found.");
      }

      const pending = await Outstanding.find({
        customerId: customerObjectId,
        status: "PENDING",
      })
        .sort({ createdAt: 1, outstandingNumber: 1 })
        .session(dbSession);

      const totalPending = pending.reduce(
        (sum, record) => sum + record.remainingAmount,
        0
      );

      if (totalPending <= 0) {
        throw new Error("This customer has no outstanding balance.");
      }

      if (input.receivedAmount > totalPending) {
        throw new Error(
          `Received amount cannot exceed outstanding balance of ${totalPending}.`
        );
      }

      let toApply = input.receivedAmount;
      const collectedAt = new Date();
      remainingBalance = totalPending - input.receivedAmount;

      const [collection] = await OutstandingCollection.create(
        [
          {
            customerId: customerObjectId,
            amount: input.receivedAmount,
            paymentMethod: input.paymentMethod,
            remainingBalanceAfter: remainingBalance,
            createdBy: input.collectedBy,
          },
        ],
        { session: dbSession }
      );

      for (const record of pending) {
        if (toApply <= 0) break;

        const applied = Math.min(toApply, record.remainingAmount);
        record.remainingAmount -= applied;
        toApply -= applied;

        if (record.remainingAmount === 0) {
          record.status = "COLLECTED";
          record.collectedAt = collectedAt;
          record.paymentMethod = input.paymentMethod;
        }

        await record.save({ session: dbSession });
      }

      collectionId = collection._id.toString();
    });

    if (!collectionId) {
      throw new Error("Failed to collect Outstanding");
    }

    return {
      remainingBalance,
      collectionId,
    };
  } finally {
    await dbSession.endSession();
  }
}
