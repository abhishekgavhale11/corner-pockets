import type { ClientSession } from "mongoose";
import type { VerificationMethod } from "@/lib/constants/verification";
import type { WalletPaymentContext } from "@/lib/wallet/wallet-payment-context";
import Customer from "@/models/Customer";
import Transaction from "@/models/Transaction";
import mongoose from "mongoose";

export type ExecuteWalletDeductInput = {
  customerId: string;
  amount: number;
  description: string;
  verificationMethod?: VerificationMethod;
  staffId: string;
  staffUsername: string;
  dbSession: ClientSession;
  /** Cash/GPay used for the bill remainder after Wallet (timeline). */
  remainingPaymentMethod?: "CASH" | "GPAY";
  /** Structured context for Customer Timeline (presentation). */
  paymentContext?: WalletPaymentContext;
  businessDayId?: string;
};

export type ExecuteWalletDeductResult = {
  transactionId: string;
  balanceAfter: number;
};

export async function executeWalletDeduct(
  input: ExecuteWalletDeductInput
): Promise<ExecuteWalletDeductResult> {
  const customer = await Customer.findById(input.customerId).session(
    input.dbSession
  );

  if (!customer || !customer.isActive) {
    throw new Error("Customer not found");
  }

  if (!customer.walletEnabled) {
    throw new Error("Wallet is not enabled for this customer");
  }

  const amount = Math.round(input.amount);

  if (amount <= 0) {
    throw new Error("Invalid amount");
  }

  if (customer.balance < amount) {
    throw new Error(
      `Insufficient balance. Available: ₹${customer.balance.toLocaleString("en-IN")}`
    );
  }

  const balanceAfter = customer.balance - amount;
  customer.balance = balanceAfter;
  await customer.save({ session: input.dbSession });

  const businessDayId =
    input.businessDayId ?? input.paymentContext?.businessDayId;

  const [transaction] = await Transaction.create(
    [
      {
        customerId: customer._id,
        type: "debit",
        amount,
        balanceAfter,
        description: input.description.trim(),
        staffId: input.staffId,
        staffUsername: input.staffUsername,
        isReversal: false,
        verificationMethod: input.verificationMethod,
        ...(input.remainingPaymentMethod
          ? { remainingPaymentMethod: input.remainingPaymentMethod }
          : {}),
        ...(input.paymentContext
          ? { paymentContext: input.paymentContext }
          : {}),
        ...(businessDayId && mongoose.Types.ObjectId.isValid(businessDayId)
          ? { businessDayId: new mongoose.Types.ObjectId(businessDayId) }
          : {}),
      },
    ],
    { session: input.dbSession }
  );

  return {
    transactionId: transaction._id.toString(),
    balanceAfter,
  };
}
