import type { ClientSession } from "mongoose";
import mongoose from "mongoose";
import { executeWalletDeduct } from "@/lib/wallet/execute-wallet-deduct";
import type { WalletPaymentContext } from "@/lib/wallet/wallet-payment-context";
import type { RemainderPaymentMethod } from "@/lib/wallet/wallet-payment-math";

export type { RemainderPaymentMethod } from "@/lib/wallet/wallet-payment-math";
export {
  computeWalletUsed,
  parseUseWalletFlag,
  remainingPaymentMethodForDebit,
  resolveWalletDebitAmount,
  resolveWalletPayment,
} from "@/lib/wallet/wallet-payment-math";

/** Server-only: debit wallet inside an existing MongoDB transaction. */
export async function debitWalletForOperationalPayment(input: {
  customerId: string;
  amount: number;
  description: string;
  staffId: string;
  staffUsername: string;
  dbSession: ClientSession;
  remainingPaymentMethod?: RemainderPaymentMethod;
  paymentContext?: WalletPaymentContext;
  businessDayId?: string;
}): Promise<mongoose.Types.ObjectId | undefined> {
  if (input.amount <= 0) return undefined;

  const result = await executeWalletDeduct({
    customerId: input.customerId,
    amount: input.amount,
    description: input.description,
    staffId: input.staffId,
    staffUsername: input.staffUsername,
    dbSession: input.dbSession,
    remainingPaymentMethod: input.remainingPaymentMethod,
    paymentContext: input.paymentContext,
    businessDayId: input.businessDayId,
  });

  return new mongoose.Types.ObjectId(result.transactionId);
}
