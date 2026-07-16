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
import Transaction from "@/models/Transaction";
import NotebookEntry from "@/models/NotebookEntry";
import NotebookSettlement from "@/models/NotebookSettlement";
import NotebookSettlementReversal from "@/models/NotebookSettlementReversal";
import type { NotebookSettlementDTO } from "@/types";
import { entryHasContributors, entryAmountRemaining, contributorAmountRemaining } from "@/lib/utils/entry-contributors";
import { closeTableSessionAfterSettlement } from "@/actions/table-sessions";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";
import {
  advanceBillPaymentWatermarks,
  collectBillIdsFromEntries,
} from "@/lib/visit-bill/entry-edit-lock";
import { linkEntriesToActiveVisitBill } from "@/lib/visit-bill/attach-entry";
import { isEntryOnActiveVisit } from "@/lib/visit-bill/active-visit";
import { isEntryOnFinishedVisit } from "@/lib/visit-bill/finished-visit-lock";
import { VISIT_FINISHED_CHECKOUT_MESSAGE } from "@/lib/visit-bill/entry-edit-lock-utils";
import { revalidateCounterPaths } from "@/lib/utils/revalidate-counter";
import { CHECKOUT_ELIGIBLE_STATUSES } from "@/lib/constants/notebook-payments";

function entryCheckoutSettled(entry: {
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
}): number {
  return (entry.paidAmount ?? 0) + (entry.balanceCollectedAmount ?? 0);
}

function contributorCheckoutSettled(contributor: {
  paidAmount?: number | null;
  balanceCollectedAmount?: number | null;
}): number {
  return (contributor.paidAmount ?? 0) + (contributor.balanceCollectedAmount ?? 0);
}

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

      for (const entry of entries) {
        if (await isEntryOnFinishedVisit(entry)) {
          throw new Error(VISIT_FINISHED_CHECKOUT_MESSAGE);
        }
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

        const onActiveVisit = await isEntryOnActiveVisit(entry, dbSession);

        if (entryHasContributors({ contributors: entry.contributors })) {
          if (!payerCustomerId) {
            throw new Error("Contributor payer is required");
          }

          const contributor = entry.contributors.find(
            (row) =>
              row.customerId.toString() === payerCustomerId &&
              contributorAmountRemaining(row) > 0
          );

          if (!contributor) {
            throw new Error("Invalid contributor allocation");
          }

          const owed = contributorAmountRemaining(contributor);
          if (allocation.amount > owed) {
            throw new Error("Allocation exceeds amount due");
          }

          contributor.paidAmount =
            (contributor.paidAmount ?? 0) + allocation.amount;

          if (onActiveVisit) {
            contributor.paymentMethod = parsed.data.paymentMethod;
          }

          if (
            !onActiveVisit &&
            contributorCheckoutSettled(contributor) >= contributor.amount
          ) {
            contributor.status = "PAID";
            contributor.paymentMethod = parsed.data.paymentMethod;
            contributor.paidAt = new Date();
          }

          contributorPayments.push({
            entryId: entry._id,
            customerId: contributor.customerId,
            customerName: contributor.customerName,
            amount: allocation.amount,
          });

          affectedCustomerIds.add(contributor.customerId.toString());

          if (
            !onActiveVisit &&
            entry.contributors.every((row) => row.status === "PAID")
          ) {
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

          if (allocation.amount > entryAmountRemaining(entry)) {
            throw new Error("Allocation exceeds amount due");
          }

          entry.paidAmount = (entry.paidAmount ?? 0) + allocation.amount;

          if (onActiveVisit) {
            entry.paymentMethod = parsed.data.paymentMethod;
            entry.paidByName = parsed.data.paidByName.trim();
            entry.paidByCustomerId = payerCustomerId
              ? new mongoose.Types.ObjectId(payerCustomerId)
              : entry.customerId;
            if (walletTransactionId) {
              entry.walletTransactionId = new mongoose.Types.ObjectId(
                walletTransactionId
              );
            }
          }

          if (entryCustomerId) {
            contributorPayments.push({
              entryId: entry._id,
              customerId: new mongoose.Types.ObjectId(entryCustomerId),
              customerName: entry.customerName,
              amount: allocation.amount,
            });
          }

          if (
            !onActiveVisit &&
            entryCheckoutSettled(entry) >= entry.amount
          ) {
            entry.status = "PAID";
            entry.paymentMethod = parsed.data.paymentMethod;
            entry.paidByName = parsed.data.paidByName.trim();
            entry.paidByCustomerId = payerCustomerId
              ? new mongoose.Types.ObjectId(payerCustomerId)
              : entry.customerId;
            entry.walletTransactionId = walletTransactionId
              ? new mongoose.Types.ObjectId(walletTransactionId)
              : undefined;
          }
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
  });

  await linkEntriesToActiveVisitBill(settledEntries, {
    username: authResult.session.user.username,
    staffId: authResult.session.user.id,
  });

  const billIds = [
    ...new Set(
      settledEntries.flatMap((entry) => {
        const ids: string[] = [];
        if (entry.billId) {
          ids.push(entry.billId.toString());
        }
        for (const contributor of entry.contributors ?? []) {
          if (contributor.billId) {
            ids.push(contributor.billId.toString());
          }
        }
        return ids;
      })
    ),
  ];

  for (const billId of billIds) {
    await syncBillTotals(new mongoose.Types.ObjectId(billId));
  }

  if (billIds.length > 0) {
    await advanceBillPaymentWatermarks(billIds, new Date());
  }

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

  const parsed = reverseNotebookSettlementSchema.safeParse({
    settlementId: formData.get("settlementId"),
    reversalReason: formData.get("reversalReason"),
    reversalReasonOther: formData.get("reversalReasonOther") || undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  const settlement = await NotebookSettlement.findById(parsed.data.settlementId);
  if (!settlement || settlement.status !== "COMPLETED") {
    return failure("Payment not found or already removed");
  }

  const entries = await NotebookEntry.find({
    _id: { $in: settlement.entryIds },
  });

  if (entries.length === 0) {
    return failure("Payment lines not found");
  }

  for (const entry of entries) {
    if (!(await isEntryOnActiveVisit(entry))) {
      return failure(
        "Checkout payments can only be removed while the visit is active"
      );
    }
  }

  const reversalLabel = getNotebookReversalReasonLabel(
    parsed.data.reversalReason,
    parsed.data.reversalReasonOther
  );

  const allocations =
    settlement.contributorPayments.length > 0
      ? settlement.contributorPayments
      : entries.length === 1 && (entries[0].customerId || settlement.paidByCustomerId)
        ? [
            {
              entryId: entries[0]._id,
              customerId:
                entries[0].customerId ?? settlement.paidByCustomerId!,
              customerName: entries[0].customerName,
              amount: settlement.totalAmount,
            },
          ]
        : [];

  if (allocations.length === 0) {
    return failure("Cannot reverse this payment automatically. Contact support.");
  }

  const dbSession = await mongoose.startSession();
  let reversedSettlement: Parameters<typeof toNotebookSettlementDTO>[0] | null =
    null;
  const affectedCustomerIds = new Set<string>();

  try {
    await dbSession.withTransaction(async () => {
      if (settlement.paymentMethod === "WALLET") {
        const payerId = settlement.paidByCustomerId?.toString();
        if (!payerId) {
          throw new Error("Wallet payer not found for this payment");
        }

        const payer = await Customer.findById(payerId).session(dbSession);
        if (!payer || !payer.isActive || !payer.walletEnabled) {
          throw new Error("Wallet payer not found");
        }

        const refundAmount = Math.round(settlement.totalAmount);
        payer.balance += refundAmount;
        await payer.save({ session: dbSession });

        await Transaction.create(
          [
            {
              customerId: payer._id,
              type: "credit",
              amount: refundAmount,
              balanceAfter: payer.balance,
              description: "Checkout payment removed",
              staffId: authResult.session.user.id,
              staffUsername: authResult.session.user.username,
              isReversal: true,
            },
          ],
          { session: dbSession }
        );
      }

      for (const allocation of allocations) {
        const entry = entries.find(
          (row) => row._id.toString() === allocation.entryId.toString()
        );
        if (!entry) {
          throw new Error("Entry not found for payment reversal");
        }

        if (entryHasContributors({ contributors: entry.contributors })) {
          const contributor = entry.contributors.find(
            (row) => row.customerId.toString() === allocation.customerId.toString()
          );
          if (!contributor) {
            throw new Error("Contributor not found for payment reversal");
          }

          contributor.paidAmount = Math.max(
            0,
            (contributor.paidAmount ?? 0) - allocation.amount
          );
          contributor.status = "PENDING";
          contributor.paymentMethod = undefined;
          contributor.paidAt = undefined;
          contributor.settlementId = undefined;
          affectedCustomerIds.add(contributor.customerId.toString());
        } else {
          entry.paidAmount = Math.max(
            0,
            (entry.paidAmount ?? 0) - allocation.amount
          );
          entry.status = "PENDING";
          entry.paymentMethod = undefined;
          entry.paidByName = undefined;
          entry.paidByCustomerId = undefined;
          entry.walletTransactionId = undefined;
          if (entry.customerId) {
            affectedCustomerIds.add(entry.customerId.toString());
          }
        }

        if (entry.settlementId?.toString() === settlement._id.toString()) {
          entry.settlementId = undefined;
        }

        entry.status = "PENDING";
        await entry.save({ session: dbSession });
      }

      settlement.status = "REVERSED";
      settlement.reversedAt = new Date();
      settlement.reversedBy = authResult.session.user.username;
      settlement.reversalReason = reversalLabel;

      const [reversalRecord] = await NotebookSettlementReversal.create(
        [
          {
            originalSettlementId: settlement._id,
            affectedEntryIds: settlement.entryIds,
            reversalReason: reversalLabel,
            reversedBy: authResult.session.user.username,
            reversedAt: new Date(),
          },
        ],
        { session: dbSession }
      );

      settlement.reversalSettlementId = reversalRecord._id;
      await settlement.save({ session: dbSession });
      reversedSettlement = settlement;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove payment";
    return failure(message);
  } finally {
    dbSession.endSession();
  }

  if (!reversedSettlement) {
    return failure("Failed to remove payment");
  }

  const billIds = [
    ...new Set(
      entries.flatMap((entry) => {
        const ids: string[] = [];
        if (entry.billId) {
          ids.push(entry.billId.toString());
        }
        for (const contributor of entry.contributors ?? []) {
          if (contributor.billId) {
            ids.push(contributor.billId.toString());
          }
        }
        return ids;
      })
    ),
  ];

  for (const billId of billIds) {
    await syncBillTotals(new mongoose.Types.ObjectId(billId));
  }

  revalidateCounterPaths();
  for (const customerId of affectedCustomerIds) {
    revalidatePath(`/customers/${customerId}`);
  }

  return success(toNotebookSettlementDTO(reversedSettlement));
}
