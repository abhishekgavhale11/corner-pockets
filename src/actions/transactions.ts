"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import {
  buildRechargeDescription,
  getPlanByKey,
  getRechargeAmounts,
} from "@/lib/constants/recharge-plans";
import Customer from "@/models/Customer";
import Transaction from "@/models/Transaction";
import {
  rechargeSchema,
  rechargeAmountsSchema,
  deductSchema,
  reverseTransactionSchema,
} from "@/lib/validators/transaction";
import { toTransactionDTO } from "@/lib/mappers";
import { getReversalReasonLabel } from "@/lib/constants/reversal-reasons";
import type { ReversalReasonKey } from "@/lib/constants/reversal-reasons";
import { formatDate } from "@/lib/utils/format";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import type { TransactionDTO } from "@/types";

export async function getCustomerTransactions(
  customerId: string,
  limit = 100
): Promise<TransactionDTO[]> {
  const authResult = await authorizePermission("TRANSACTION_VIEW");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const transactions = await Transaction.find({ customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return transactions.map((t) => toTransactionDTO(t));
}

export async function rechargeWallet(
  formData: FormData
): Promise<ActionResult<TransactionDTO>> {
  const authResult = await authorizePermission("WALLET_RECHARGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const session = authResult.session;

  const parsed = rechargeSchema.safeParse({
    customerId: formData.get("customerId"),
    planKey: formData.get("planKey"),
    verificationMethod: formData.get("verificationMethod"),
    customerConfirmed: formData.get("customerConfirmed"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const plan = getPlanByKey(parsed.data.planKey);
  if (!plan) {
    return failure("Invalid recharge plan");
  }

  const amountsParsed = rechargeAmountsSchema.safeParse(
    getRechargeAmounts(plan)
  );
  if (!amountsParsed.success) {
    return failure("Invalid recharge plan amounts");
  }

  const { paidAmount, bonusAmount, creditedAmount } = amountsParsed.data;

  await connectDB();

  const dbSession = await mongoose.startSession();

  try {
    let transactionDoc: Parameters<typeof toTransactionDTO>[0] | null = null;

    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(parsed.data.customerId).session(
        dbSession
      );

      if (!customer || !customer.isActive) {
        throw new Error("Customer not found");
      }

      const expectedWalletType = customer.isStudent ? "student" : "club";
      if (plan.walletType !== expectedWalletType) {
        throw new Error(
          customer.isStudent
            ? "This customer can only use Student wallet plans"
            : "This customer can only use Club wallet plans"
        );
      }

      const balanceAfter = customer.balance + creditedAmount;

      customer.balance = balanceAfter;
      await customer.save({ session: dbSession });

      const [transaction] = await Transaction.create(
        [
          {
            customerId: customer._id,
            type: "credit",
            paidAmount,
            bonusAmount,
            creditedAmount,
            balanceAfter,
            description: buildRechargeDescription(plan),
            staffId: session.user.id,
            staffUsername: session.user.username,
            isReversal: false,
            verificationMethod: parsed.data.verificationMethod,
          },
        ],
        { session: dbSession }
      );

      transactionDoc = transaction;
    });

    if (!transactionDoc) {
      return failure("Recharge failed");
    }

    revalidateCustomerPaths(parsed.data.customerId);

    return success(toTransactionDTO(transactionDoc));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recharge failed";
    return failure(message);
  } finally {
    dbSession.endSession();
  }
}

export async function deductWallet(
  formData: FormData
): Promise<ActionResult<TransactionDTO>> {
  const authResult = await authorizePermission("WALLET_DEDUCT");
  if (!("session" in authResult)) {
    return authResult;
  }

  const session = authResult.session;

  const parsed = deductSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    verificationMethod: formData.get("verificationMethod"),
    customerConfirmed: formData.get("customerConfirmed"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const dbSession = await mongoose.startSession();

  try {
    let transactionDoc: Parameters<typeof toTransactionDTO>[0] | null = null;

    await dbSession.withTransaction(async () => {
      const customer = await Customer.findById(parsed.data.customerId).session(
        dbSession
      );

      if (!customer || !customer.isActive) {
        throw new Error("Customer not found");
      }

      const amount = Math.round(parsed.data.amount);

      if (customer.balance < amount) {
        throw new Error(
          `Insufficient balance. Available: ₹${customer.balance.toLocaleString("en-IN")}`
        );
      }

      const balanceAfter = customer.balance - amount;

      customer.balance = balanceAfter;
      await customer.save({ session: dbSession });

      const [transaction] = await Transaction.create(
        [
          {
            customerId: customer._id,
            type: "debit",
            amount,
            balanceAfter,
            description: parsed.data.description.trim(),
            staffId: session.user.id,
            staffUsername: session.user.username,
            isReversal: false,
            verificationMethod: parsed.data.verificationMethod,
          },
        ],
        { session: dbSession }
      );

      transactionDoc = transaction;
    });

    if (!transactionDoc) {
      return failure("Deduction failed");
    }

    revalidateCustomerPaths(parsed.data.customerId);

    return success(toTransactionDTO(transactionDoc));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Deduction failed";
    return failure(message);
  } finally {
    dbSession.endSession();
  }
}

function revalidateCustomerPaths(customerId: string) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/recharge`);
  revalidatePath(`/customers/${customerId}/deduct`);
  revalidatePath(`/customers/${customerId}/transactions`);
  revalidatePath("/customers");
  revalidatePath("/wallet/recharge");
  revalidatePath("/wallet/deduct");
  revalidatePath("/dashboard");
}

export async function reverseTransaction(
  formData: FormData
): Promise<ActionResult<TransactionDTO>> {
  const authResult = await authorizePermission("TRANSACTION_REVERSE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const session = authResult.session;

  const parsed = reverseTransactionSchema.safeParse({
    customerId: formData.get("customerId"),
    transactionId: formData.get("transactionId"),
    reversalReason: formData.get("reversalReason"),
    reversalReasonOther: formData.get("reversalReasonOther") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const dbSession = await mongoose.startSession();

  try {
    let reversalDoc: Parameters<typeof toTransactionDTO>[0] | null = null;

    await dbSession.withTransaction(async () => {
      const original = await Transaction.findById(
        parsed.data.transactionId
      ).session(dbSession);

      if (
        !original ||
        original.customerId.toString() !== parsed.data.customerId
      ) {
        throw new Error("Transaction not found");
      }

      if (original.isReversal || original.reversesTransactionId) {
        throw new Error("Cannot reverse a reversal transaction");
      }

      if (original.reversedAt) {
        throw new Error("This transaction has already been reversed");
      }

      const customer = await Customer.findById(parsed.data.customerId).session(
        dbSession
      );

      if (!customer || !customer.isActive) {
        throw new Error("Customer not found");
      }

      const staffUsername = session.user.username;
      const originalTypeLabel =
        original.type === "credit" ? "recharge" : "debit";
      const reversalReasonLabel = getReversalReasonLabel(
        parsed.data.reversalReason as ReversalReasonKey,
        parsed.data.reversalReasonOther
      );
      const reversalDescription = `Reversal of ${originalTypeLabel} from ${formatDate(original.createdAt)} — ${reversalReasonLabel}`;

      if (original.type === "credit") {
        const creditAmount = original.creditedAmount ?? 0;
        if (creditAmount <= 0) {
          throw new Error("Invalid recharge amount to reverse");
        }
        if (customer.balance < creditAmount) {
          throw new Error(
            `Insufficient balance to reverse recharge. Available: ₹${customer.balance.toLocaleString("en-IN")}`
          );
        }

        const balanceAfter = customer.balance - creditAmount;
        customer.balance = balanceAfter;
        await customer.save({ session: dbSession });

        const [reversal] = await Transaction.create(
          [
            {
              customerId: customer._id,
              type: "debit",
              amount: creditAmount,
              balanceAfter,
              description: reversalDescription,
              staffId: session.user.id,
              staffUsername,
              isReversal: true,
              reversesTransactionId: original._id,
            },
          ],
          { session: dbSession }
        );

        original.reversedAt = new Date();
        original.reversedBy = staffUsername;
        original.reversalReason = reversalReasonLabel;
        original.reversalTransactionId = reversal._id;
        await original.save({ session: dbSession });

        reversalDoc = reversal;
      } else {
        const debitAmount = original.amount ?? 0;
        if (debitAmount <= 0) {
          throw new Error("Invalid debit amount to reverse");
        }

        const balanceAfter = customer.balance + debitAmount;
        customer.balance = balanceAfter;
        await customer.save({ session: dbSession });

        const [reversal] = await Transaction.create(
          [
            {
              customerId: customer._id,
              type: "credit",
              paidAmount: debitAmount,
              bonusAmount: 0,
              creditedAmount: debitAmount,
              balanceAfter,
              description: reversalDescription,
              staffId: session.user.id,
              staffUsername,
              isReversal: true,
              reversesTransactionId: original._id,
            },
          ],
          { session: dbSession }
        );

        original.reversedAt = new Date();
        original.reversedBy = staffUsername;
        original.reversalReason = reversalReasonLabel;
        original.reversalTransactionId = reversal._id;
        await original.save({ session: dbSession });

        reversalDoc = reversal;
      }
    });

    if (!reversalDoc) {
      return failure("Reversal failed");
    }

    revalidateCustomerPaths(parsed.data.customerId);

    return success(toTransactionDTO(reversalDoc));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reversal failed";
    return failure(message);
  } finally {
    dbSession.endSession();
  }
}
