"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { recordCustomerBalancePaymentSchema } from "@/lib/validators/notebook";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import {
  applyBalancePaymentFifo,
  saveBalancePaymentEntries,
} from "@/lib/wallet/apply-balance-payment";
import { executeWalletDeduct } from "@/lib/wallet/execute-wallet-deduct";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import { revalidateCustomerFinancials } from "@/lib/utils/revalidate-counter";
import type { CustomerBalancePaymentDTO } from "@/types";
import Customer from "@/models/Customer";
import CustomerBalancePayment from "@/models/CustomerBalancePayment";
import NotebookEntry from "@/models/NotebookEntry";

function toCustomerBalancePaymentDTO(payment: {
  _id: { toString(): string };
  customerId: { toString(): string };
  amount: number;
  appliedAmount: number;
  paymentMethod: CustomerBalancePaymentDTO["paymentMethod"];
  walletTransactionId?: { toString(): string };
  createdBy: string;
  createdAt: Date;
}): CustomerBalancePaymentDTO {
  return {
    id: payment._id.toString(),
    customerId: payment.customerId.toString(),
    amount: payment.amount,
    appliedAmount: payment.appliedAmount,
    paymentMethod: payment.paymentMethod,
    walletTransactionId: payment.walletTransactionId?.toString(),
    createdBy: payment.createdBy,
    createdAt: payment.createdAt.toISOString(),
  };
}

export async function recordCustomerBalancePayment(
  formData: FormData
): Promise<ActionResult<CustomerBalancePaymentDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_SETTLE");
  if (!("session" in authResult)) {
    return authResult;
  }

  let entryIds: string[] | undefined;
  const entryIdsRaw = formData.get("entryIds");
  if (entryIdsRaw) {
    try {
      const parsedIds = JSON.parse(String(entryIdsRaw));
      if (Array.isArray(parsedIds) && parsedIds.length > 0) {
        entryIds = parsedIds.map(String);
      }
    } catch {
      return failure("Invalid bill entries");
    }
  }

  const parsed = recordCustomerBalancePaymentSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    verificationMethod: formData.get("verificationMethod") || undefined,
    entryIds,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();


  const customer = await Customer.findById(parsed.data.customerId);
  if (!customer || !customer.isActive) {
    return failure("Customer not found");
  }

  if (parsed.data.paymentMethod === "WALLET" && !customer.walletEnabled) {
    return failure("Wallet is not enabled for this customer");
  }

  // Active-visit checkout block removed with Financial Engine V1 (always 0).

  const dbSession = await mongoose.startSession();
  let paymentDoc: Parameters<typeof toCustomerBalancePaymentDTO>[0] | null =
    null;
  let appliedEntryIds: string[] = [];

  try {
    await dbSession.withTransaction(async () => {
      const paidAt = new Date();
      let entries;

      if (parsed.data.entryIds?.length) {
        entries = await NotebookEntry.find({
          _id: { $in: parsed.data.entryIds },
          status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
        })
          .sort({ createdAt: 1 })
          .session(dbSession);

        if (entries.length !== parsed.data.entryIds.length) {
          throw new Error(
            "One or more bill lines are no longer payable. Please refresh and try again."
          );
        }

        for (const entry of entries) {
          if (entryHasContributors({ contributors: entry.contributors })) {
            continue;
          }
          if (entry.customerId?.toString() !== parsed.data.customerId) {
            throw new Error("Bill line belongs to a different customer");
          }
        }
      } else {
        entries = await NotebookEntry.find({
          status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
          checkoutDismissedAt: { $exists: true, $ne: null },
          $or: [
            { customerId: parsed.data.customerId },
            {
              contributors: {
                $elemMatch: {
                  customerId: new mongoose.Types.ObjectId(
                    parsed.data.customerId
                  ),
                },
              },
            },
          ],
        })
          .sort({ createdAt: 1 })
          .session(dbSession);
      }

      const { allocations, appliedAmount } = applyBalancePaymentFifo(
        entries,
        parsed.data.customerId,
        parsed.data.amount,
        parsed.data.paymentMethod,
        paidAt
      );
      if (appliedAmount <= 0) {
        throw new Error("No pay-later balance to collect.");
      }
      if (appliedAmount !== parsed.data.amount) {
        throw new Error(
          "Amount exceeds outstanding balance for this customer."
        );
      }
      appliedEntryIds = allocations.map((row) => row.entryId);

      let walletTransactionId: string | undefined;

      if (parsed.data.paymentMethod === "WALLET") {
        const walletResult = await executeWalletDeduct({
          customerId: parsed.data.customerId,
          amount: parsed.data.amount,
          description: `Balance payment — ${parsed.data.amount.toLocaleString("en-IN")}`,
          verificationMethod: parsed.data.verificationMethod!,
          staffId: authResult.session.user.id,
          staffUsername: authResult.session.user.username,
          dbSession,
        });
        walletTransactionId = walletResult.transactionId;
      }

      await saveBalancePaymentEntries(entries, dbSession);

      const [payment] = await CustomerBalancePayment.create(
        [
          {
            customerId: customer._id,
            amount: parsed.data.amount,
            appliedAmount,
            paymentMethod: parsed.data.paymentMethod,
            walletTransactionId,
            allocations: allocations.map((row) => ({
              entryId: new mongoose.Types.ObjectId(row.entryId),
              amount: row.amount,
            })),
            createdBy: authResult.session.user.username,
            createdByStaffId: authResult.session.user.id,
          },
        ],
        { session: dbSession }
      );
      paymentDoc = payment;
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Failed to record payment"
    );
  } finally {
    dbSession.endSession();
  }

  if (!paymentDoc) {
    return failure("Failed to record payment");
  }


  revalidateCustomerFinancials(parsed.data.customerId);

  return success(toCustomerBalancePaymentDTO(paymentDoc));
}

export async function getCustomerBalancePayments(
  customerId: string
): Promise<CustomerBalancePaymentDTO[]> {
  const authResult = await authorizePermission("CUSTOMER_SEARCH");
  if (!("session" in authResult)) {
    return [];
  }

  await connectDB();

  const payments = await CustomerBalancePayment.find({ customerId })
    .sort({ createdAt: 1 })
    .lean();

  return payments.map((payment) => toCustomerBalancePaymentDTO(payment));
}
