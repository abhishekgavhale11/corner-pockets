import type { ClientSession, Types } from "mongoose";
import type { NotebookEntryDTO } from "@/types";
import {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  entryReceivedPayment,
  entryBlocksCustomerReassignment,
  isNotebookEntryEditLocked,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import Bill from "@/models/Bill";
import type { INotebookEntry } from "@/models/NotebookEntry";

export {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  entryReceivedPayment,
  entryBlocksCustomerReassignment,
  isNotebookEntryEditLocked,
};

export function enrichEntryDTOWithEditLock(
  entry: NotebookEntryDTO
): NotebookEntryDTO {
  return {
    ...entry,
    isLocked: isNotebookEntryEditLocked(entry),
  };
}

export async function getBillLastPaymentAtMap(
  billIds: string[]
): Promise<Map<string, Date | undefined>> {
  const uniqueIds = [...new Set(billIds.filter(Boolean))];
  const map = new Map<string, Date | undefined>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const bills = await Bill.find({ _id: { $in: uniqueIds } })
    .select("_id lastPaymentAt")
    .lean();

  for (const bill of bills) {
    map.set(bill._id.toString(), bill.lastPaymentAt ?? undefined);
  }

  return map;
}

export async function enrichEntriesWithEditLock(
  entries: NotebookEntryDTO[]
): Promise<NotebookEntryDTO[]> {
  return entries.map((entry) => enrichEntryDTOWithEditLock(entry));
}

export async function getEntryEditLockFailure(
  entry: Pick<
    INotebookEntry,
    | "status"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "contributors"
  >
): Promise<string | null> {
  const locked = isNotebookEntryEditLocked({
    status: entry.status,
    paidAmount: entry.paidAmount ?? 0,
    balanceCollectedAmount: entry.balanceCollectedAmount ?? 0,
    contributors: entry.contributors?.map((contributor) => ({
      status: contributor.status,
      paidAmount: contributor.paidAmount,
      balanceCollectedAmount: contributor.balanceCollectedAmount,
    })),
  });

  return locked ? ENTRY_LOCKED_MESSAGE : null;
}

export function getCustomerReassignmentFailure(
  entry: Pick<
    INotebookEntry,
    | "status"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "contributors"
  >
): string | null {
  return entryBlocksCustomerReassignment(entry)
    ? ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE
    : null;
}

export async function advanceBillPaymentWatermark(
  billId: Types.ObjectId | string,
  paymentAt: Date,
  dbSession?: ClientSession
): Promise<void> {
  await Bill.findByIdAndUpdate(
    billId,
    { $max: { lastPaymentAt: paymentAt } },
    { session: dbSession ?? null }
  );
}

export async function advanceBillPaymentWatermarks(
  billIds: Iterable<string | Types.ObjectId>,
  paymentAt: Date,
  dbSession?: ClientSession
): Promise<void> {
  const uniqueIds = [
    ...new Set(
      [...billIds].map((billId) =>
        typeof billId === "string" ? billId : billId.toString()
      )
    ),
  ];

  await Promise.all(
    uniqueIds.map((billId) =>
      advanceBillPaymentWatermark(billId, paymentAt, dbSession)
    )
  );
}

export function collectBillIdsFromEntries(
  entries: Array<{
    billId?: Types.ObjectId | null;
    contributors?: Array<{ billId?: Types.ObjectId | null }>;
  }>
): string[] {
  const billIds = new Set<string>();

  for (const entry of entries) {
    if (entry.billId) {
      billIds.add(entry.billId.toString());
    }
    for (const contributor of entry.contributors ?? []) {
      if (contributor.billId) {
        billIds.add(contributor.billId.toString());
      }
    }
  }

  return [...billIds];
}
