"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import {
  getNotebookReversalReasonLabel,
  type NotebookReversalReasonKey,
} from "@/lib/constants/notebook-payments";
import { executeWalletDeduct } from "@/lib/wallet/execute-wallet-deduct";
import {
  reverseNotebookSettlementSchema,
  settleNotebookEntriesSchema,
} from "@/lib/validators/notebook";
import { toNotebookSettlementDTO } from "@/lib/mappers/notebook";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import Customer from "@/models/Customer";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import NotebookSettlementReversal from "@/models/NotebookSettlementReversal";
import type { NotebookSettlementDTO } from "@/types";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { closeTableSessionAfterSettlement } from "@/actions/table-sessions";

import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";

export async function settleNotebookEntries(
  formData: FormData
): Promise<ActionResult<NotebookSettlementDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_SETTLE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const entryIds = formData.getAll("entryIds").map(String);
  let allocations: { entryId: string; amount: number }[] | undefined;
  const allocationsRaw = formData.get("allocations");
  if (allocationsRaw) {
    try {
      allocations = JSON.parse(String(allocationsRaw));
    } catch {
      return failure("Invalid payment allocations");
    }
  }

  const parsed = settleNotebookEntriesSchema.safeParse({
    entryIds,
    allocations,
    paymentMethod: formData.get("paymentMethod"),
    paidByName: formData.get("paidByName"),
    paidByCustomerId: formData.get("paidByCustomerId") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    verificationMethod: formData.get("verificationMethod") || undefined,
    customerConfirmed: formData.get("customerConfirmed") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const existing = await NotebookSettlement.findOne({
    idempotencyKey: parsed.data.idempotencyKey,
  }).lean();

  if (existing) {
    return success(toNotebookSettlementDTO(existing));
  }

  const dbSession = await mongoose.startSession();
  let settlementDoc: Parameters<typeof toNotebookSettlementDTO>[0] | null =
    null;
  const affectedCustomerIds = new Set<string>();

  try {
    await dbSession.withTransaction(async () => {
      const entries = await NotebookEntry.find({
        _id: { $in: parsed.data.entryIds },
        status: { $in: [...CHECKOUT_ELIGIBLE_STATUSES] },
      }).session(dbSession);

      if (entries.length !== parsed.data.entryIds.length) {
        throw new Error(
          "One or more entries are no longer payable. Please refresh and try again."
        );
      }

      const payerCustomerId = parsed.data.paidByCustomerId;
      const paymentAllocations =
        parsed.data.allocations ??
        entries.map((entry) => ({
          entryId: entry._id.toString(),
          amount: entry.amount,
        }));

      const totalAmount = paymentAllocations.reduce(
        (sum, row) => sum + row.amount,
        0
      );

      if (totalAmount <= 0) {
        throw new Error("Invalid settlement total");
      }

      let walletTransactionId: string | undefined;

      if (parsed.data.paymentMethod === "WALLET") {
        if (!payerCustomerId || !parsed.data.verificationMethod) {
          throw new Error("Wallet verification is required");
        }

        const payer = await Customer.findById(payerCustomerId).session(dbSession);

        if (!payer || !payer.isActive || !payer.walletEnabled) {
          throw new Error("Wallet payer not found or wallet not enabled");
        }

        const walletResult = await executeWalletDeduct({
          customerId: payer._id.toString(),
          amount: totalAmount,
          description: `Notebook settlement — ${paymentAllocations.length} allocation(s)`,
          verificationMethod: parsed.data.verificationMethod,
          staffId: authResult.session.user.id,
          staffUsername: authResult.session.user.username,
          dbSession,
        });

        walletTransactionId = walletResult.transactionId;
      }

      const contributorPayments: {
        entryId: mongoose.Types.ObjectId;
        customerId: mongoose.Types.ObjectId;
        customerName: string;
        amount: number;
      }[] = [];

      for (const allocation of paymentAllocations) {
        const entry = entries.find(
          (row) => row._id.toString() === allocation.entryId
        );
        if (!entry) {
          throw new Error("Entry not found for allocation");
        }

        if (entryHasContributors({ contributors: entry.contributors })) {
          if (!payerCustomerId) {
            throw new Error("Contributor payer is required");
          }

          const contributor = entry.contributors.find(
            (row) =>
              row.customerId.toString() === payerCustomerId &&
              row.status === "PENDING"
          );

          if (!contributor || contributor.amount !== allocation.amount) {
            throw new Error("Invalid contributor allocation");
          }

          contributor.status = "PAID";
          contributor.paymentMethod = parsed.data.paymentMethod;
          contributor.settlementId = undefined;
          contributor.paidAt = new Date();

          contributorPayments.push({
            entryId: entry._id,
            customerId: contributor.customerId,
            customerName: contributor.customerName,
            amount: contributor.amount,
          });

          affectedCustomerIds.add(contributor.customerId.toString());

          if (entry.contributors.every((row) => row.status === "PAID")) {
            entry.status = "PAID";
            entry.paymentMethod = parsed.data.paymentMethod;
            entry.paidByName = parsed.data.paidByName.trim();
            entry.paidByCustomerId = payerCustomerId
              ? new mongoose.Types.ObjectId(payerCustomerId)
              : undefined;
            entry.walletTransactionId = walletTransactionId
              ? new mongoose.Types.ObjectId(walletTransactionId)
              : undefined;
          }
        } else {
          let entryCustomerId = entry.customerId?.toString();

          if (!entryCustomerId) {
            if (!payerCustomerId) {
              throw new Error("Select a customer for this table bill");
            }

            const assignee = await Customer.findById(payerCustomerId).session(
              dbSession
            );
            if (!assignee || !assignee.isActive) {
              throw new Error("Customer not found");
            }

            entry.customerId = assignee._id;
            entry.customerName = assignee.name;
            entry.phoneNumber = assignee.phone ?? "";
            if (!entry.assignedAt) {
              entry.assignedAt = new Date();
              entry.assignedBy = authResult.session.user.username;
            }
            entryCustomerId = assignee._id.toString();
            affectedCustomerIds.add(entryCustomerId);
          } else if (
            payerCustomerId &&
            entryCustomerId !== payerCustomerId
          ) {
            throw new Error("Payer does not match entry customer");
          }

          if (allocation.amount !== entry.amount) {
            throw new Error("Invalid allocation amount");
          }

          entry.status = "PAID";
          entry.paymentMethod = parsed.data.paymentMethod;
          entry.paidByName = parsed.data.paidByName.trim();
          entry.paidByCustomerId = payerCustomerId
            ? new mongoose.Types.ObjectId(payerCustomerId)
            : entry.customerId;
          entry.walletTransactionId = walletTransactionId
            ? new mongoose.Types.ObjectId(walletTransactionId)
            : undefined;
          if (entryCustomerId) {
            affectedCustomerIds.add(entryCustomerId);
          }
        }

        await entry.save({ session: dbSession });
      }

      const [settlement] = await NotebookSettlement.create(
        [
          {
            entryIds: entries.map((entry) => entry._id),
            totalAmount,
            paymentMethod: parsed.data.paymentMethod,
            paidByName: parsed.data.paidByName.trim(),
            paidByCustomerId: payerCustomerId,
            walletTransactionId,
            contributorPayments,
            idempotencyKey: parsed.data.idempotencyKey,
            status: "COMPLETED",
            createdBy: authResult.session.user.username,
            createdByStaffId: authResult.session.user.id,
          },
        ],
        { session: dbSession }
      );

      if (contributorPayments.length > 0) {
        for (const payment of contributorPayments) {
          const entry = entries.find(
            (row) => row._id.toString() === payment.entryId.toString()
          );
          if (!entry) continue;
          const contributor = entry.contributors.find(
            (row) => row.customerId.toString() === payment.customerId.toString()
          );
          if (contributor) {
            contributor.settlementId = settlement._id;
          }
          await entry.save({ session: dbSession });
        }
      } else {
        for (const entry of entries) {
          entry.settlementId = settlement._id;
          await entry.save({ session: dbSession });
        }
      }

      settlementDoc = settlement;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Settlement failed";
    return failure(message);
  } finally {
    dbSession.endSession();
  }

  if (!settlementDoc) {
    return failure("Settlement failed");
  }

  const settledEntries = await NotebookEntry.find({
    _id: { $in: parsed.data.entryIds },
  }).select("sessionId");

  const sessionIds = [
    ...new Set(
      settledEntries
        .map((entry) => entry.sessionId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  for (const sessionId of sessionIds) {
    await closeTableSessionAfterSettlement(sessionId);
  }

  revalidateCounterPaths();
  for (const customerId of affectedCustomerIds) {
    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/customers/${customerId}/transactions`);
  }

  return success(toNotebookSettlementDTO(settlementDoc));
}

export async function reverseNotebookSettlement(
  formData: FormData
): Promise<ActionResult<NotebookSettlementDTO>> {
  const authResult = await authorizePermission("NOTEBOOK_SETTLEMENT_REVERSE");
  if (!("session" in authResult)) {
    return authResult;
  }

  void formData;
  return failure("Payment settlements cannot be reversed. Only wallet recharges can be reversed.");
}
