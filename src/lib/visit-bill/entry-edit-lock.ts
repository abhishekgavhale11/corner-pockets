import type { ClientSession, Types } from "mongoose";
import type { NotebookEntryDTO } from "@/types";
import {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  entryReceivedPayment,
  isEntryLockedByPayment,
  isNotebookEntryEditLocked,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import Bill from "@/models/Bill";
import type { INotebookEntry } from "@/models/NotebookEntry";

export {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  isEntryLockedByPayment,
  entryReceivedPayment,
  isNotebookEntryEditLocked,
};

export function enrichEntryDTOWithEditLock(
  entry: NotebookEntryDTO,
  billLastPaymentAt: Map<string, Date | undefined>
): NotebookEntryDTO {
  const lastPaymentAt = entry.billId
    ? billLastPaymentAt.get(entry.billId)?.toISOString()
    : undefined;

  return {
    ...entry,
    isLocked: isNotebookEntryEditLocked({
      status: entry.status,
      createdAt: entry.createdAt,
      billId: entry.billId,
      paidAmount: entry.paidAmount,
      balanceCollectedAmount: entry.balanceCollectedAmount,
      lastPaymentAt,
    }),
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
  const billIds = entries
    .map((entry) => entry.billId)
    .filter((billId): billId is string => Boolean(billId));

  const billLastPaymentAt = await getBillLastPaymentAtMap(billIds);
  return entries.map((entry) =>
    enrichEntryDTOWithEditLock(entry, billLastPaymentAt)
  );
}

export async function getEntryEditLockFailure(
  entry: Pick<
    INotebookEntry,
    | "status"
    | "billId"
    | "createdAt"
    | "paidAmount"
    | "balanceCollectedAmount"
  >
): Promise<string | null> {
  let lastPaymentAt: string | undefined;

  if (entry.billId) {
    const bill = await Bill.findById(entry.billId).select("lastPaymentAt").lean();
    lastPaymentAt = bill?.lastPaymentAt?.toISOString();
  }

  const locked = isNotebookEntryEditLocked({
    status: entry.status,
    createdAt: entry.createdAt.toISOString(),
    billId: entry.billId?.toString(),
    paidAmount: entry.paidAmount ?? 0,
    balanceCollectedAmount: entry.balanceCollectedAmount ?? 0,
    lastPaymentAt,
  });

  return locked ? ENTRY_LOCKED_MESSAGE : null;
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
