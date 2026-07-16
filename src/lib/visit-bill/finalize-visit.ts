import mongoose, { type ClientSession } from "mongoose";
import Bill from "@/models/Bill";
import Visit from "@/models/Visit";
import NotebookEntry from "@/models/NotebookEntry";
import { entryHasContributors } from "@/lib/utils/entry-contributors";
import { syncBillTotals } from "@/lib/visit-bill/sync-bill-totals";

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

async function commitVisitBillPayments(
  billId: mongoose.Types.ObjectId,
  dbSession?: ClientSession
): Promise<void> {
  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      { billId },
      { contributors: { $elemMatch: { billId } } },
    ],
  }).session(dbSession ?? null);

  for (const entry of entries) {
    let changed = false;

    if (entryHasContributors(entry)) {
      for (const contributor of entry.contributors ?? []) {
        if (contributor.billId?.toString() !== billId.toString()) {
          continue;
        }
        if (
          contributor.status !== "PAID" &&
          contributorCheckoutSettled(contributor) >= contributor.amount
        ) {
          contributor.status = "PAID";
          contributor.paidAt = contributor.paidAt ?? new Date();
          changed = true;
        }
      }

      if (
        entry.contributors?.length &&
        entry.contributors.every((row) => row.status === "PAID")
      ) {
        entry.status = "PAID";
        changed = true;
      }
    } else if (entry.billId?.toString() === billId.toString()) {
      if (
        entry.status !== "PAID" &&
        entryCheckoutSettled(entry) >= entry.amount
      ) {
        entry.status = "PAID";
        changed = true;
      }
    }

    if (changed) {
      await entry.save({ session: dbSession ?? null });
    }
  }
}

export const UNASSIGNED_FRAMES_BLOCK_FINISH_MESSAGE =
  "Assign all frames before finishing the visit.";

export type FinalizeVisitStaff = {
  username: string;
  staffId: string;
};

export async function validateVisitReadyToFinish(
  billId: string | mongoose.Types.ObjectId,
  dbSession?: ClientSession
): Promise<{ ok: true } | { ok: false; error: string }> {
  const billObjectId =
    typeof billId === "string" ? new mongoose.Types.ObjectId(billId) : billId;

  const entries = await NotebookEntry.find({
    status: { $ne: "CANCELLED" },
    $or: [
      { billId: billObjectId },
      { contributors: { $elemMatch: { billId: billObjectId } } },
    ],
  }).session(dbSession ?? null);

  for (const entry of entries) {
    if (entryHasContributors(entry)) {
      for (const contributor of entry.contributors ?? []) {
        if (
          contributor.billId?.toString() === billObjectId.toString() &&
          !contributor.customerId
        ) {
          return { ok: false, error: UNASSIGNED_FRAMES_BLOCK_FINISH_MESSAGE };
        }
      }
      continue;
    }

    if (!entry.customerId) {
      return { ok: false, error: UNASSIGNED_FRAMES_BLOCK_FINISH_MESSAGE };
    }
  }

  return { ok: true };
}

export async function finalizeVisitByBillId(
  billId: string | mongoose.Types.ObjectId,
  staff: FinalizeVisitStaff,
  dbSession?: ClientSession
): Promise<{ visitId: string; billId: string; dueAmount: number } | null> {
  const billObjectId =
    typeof billId === "string" ? new mongoose.Types.ObjectId(billId) : billId;

  const visit = await Visit.findOne({ billId: billObjectId }).session(
    dbSession ?? null
  );
  if (!visit) {
    return null;
  }

  if (visit.status === "FINISHED") {
    const currentBill = await Bill.findById(billObjectId).session(dbSession ?? null);
    return currentBill
      ? {
          visitId: visit._id.toString(),
          billId: currentBill._id.toString(),
          dueAmount: currentBill.dueAmount,
        }
      : null;
  }

  const assignmentCheck = await validateVisitReadyToFinish(billObjectId, dbSession);
  if (!assignmentCheck.ok) {
    throw new Error(assignmentCheck.error);
  }

  await commitVisitBillPayments(billObjectId, dbSession);

  const syncedBill = await syncBillTotals(billObjectId, dbSession);
  if (!syncedBill) {
    return null;
  }

  const finalizedAt = new Date();
  syncedBill.status = "FINISHED";
  if (syncedBill.dueAmount > 0) {
    syncedBill.convertedToOutstandingAt = finalizedAt;
    syncedBill.convertedToOutstandingBy = staff.username;
  } else {
    syncedBill.convertedToOutstandingAt = undefined;
    syncedBill.convertedToOutstandingBy = undefined;
  }
  await syncedBill.save({ session: dbSession ?? null });

  visit.status = "FINISHED";
  visit.finishedAt = finalizedAt;
  visit.finishedBy = staff.username;
  visit.finishedByStaffId = new mongoose.Types.ObjectId(staff.staffId);
  visit.ledgerCommittedAt = finalizedAt;
  visit.closedAt = finalizedAt;
  await visit.save({ session: dbSession ?? null });

  return {
    visitId: visit._id.toString(),
    billId: syncedBill._id.toString(),
    dueAmount: syncedBill.dueAmount,
  };
}

export async function finalizeActiveVisitForCustomer(
  customerId: string,
  staff: FinalizeVisitStaff,
  dbSession?: ClientSession
): Promise<{ visitId: string; billId: string; dueAmount: number } | null> {
  const visit = await Visit.findOne({
    customerId: new mongoose.Types.ObjectId(customerId),
    status: "ACTIVE",
  }).session(dbSession ?? null);

  if (!visit) {
    return null;
  }

  return finalizeVisitByBillId(visit.billId, staff, dbSession);
}
