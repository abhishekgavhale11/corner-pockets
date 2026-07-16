import type { ClientSession, Types } from "mongoose";
import type { NotebookEntryDTO } from "@/types";
import {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  VISIT_FINISHED_LOCK_MESSAGE,
  SPLIT_CONTRIBUTOR_LOCKED_MESSAGE,
  FRAME_STRUCTURE_LOCKED_MESSAGE,
  FRAME_PARTIAL_LOCK_REASSIGN_HINT,
  entryReceivedPayment,
  contributorHasCheckoutPayment,
  isContributorAssignmentLocked,
  isContributorReassignable,
  frameHasPartialPaymentLock,
  isFrameStructureLocked,
  entryBlocksCustomerReassignment,
  isNotebookEntryEditLocked,
  isContributorEditLocked,
  splitEntryHasEditableContributor,
  getEntryLockTooltip,
  getContributorLockTooltip,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import {
  collectBillIdsFromEntryDtos,
  getFinishedBillIdSet,
  isEntryOnFinishedVisit,
  resolveEntryVisitStatus,
} from "@/lib/visit-bill/finished-visit-lock";
import Bill from "@/models/Bill";
import type { INotebookEntry } from "@/models/NotebookEntry";

export {
  ENTRY_LOCKED_MESSAGE,
  ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE,
  ENTRY_LOCKED_TOOLTIP,
  VISIT_FINISHED_LOCK_MESSAGE,
  SPLIT_CONTRIBUTOR_LOCKED_MESSAGE,
  FRAME_STRUCTURE_LOCKED_MESSAGE,
  FRAME_PARTIAL_LOCK_REASSIGN_HINT,
  entryReceivedPayment,
  contributorHasCheckoutPayment,
  isContributorAssignmentLocked,
  isContributorReassignable,
  frameHasPartialPaymentLock,
  isFrameStructureLocked,
  entryBlocksCustomerReassignment,
  isNotebookEntryEditLocked,
  isContributorEditLocked,
  splitEntryHasEditableContributor,
  getEntryLockTooltip,
  getContributorLockTooltip,
};

export function enrichEntryDTOWithEditLock(
  entry: NotebookEntryDTO,
  finishedBillIds: Set<string> = new Set()
): NotebookEntryDTO {
  const visitStatus = resolveEntryVisitStatus(entry, finishedBillIds);
  const contributors = entry.contributors?.map((contributor) => ({
    ...contributor,
    visitStatus:
      contributor.billId && finishedBillIds.has(contributor.billId)
        ? ("FINISHED" as const)
        : ("ACTIVE" as const),
  }));

  return {
    ...entry,
    contributors,
    visitStatus,
    isLocked: isNotebookEntryEditLocked({
      status: entry.status,
      visitStatus,
      paidAmount: entry.paidAmount,
      balanceCollectedAmount: entry.balanceCollectedAmount,
      contributors,
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
  entries: NotebookEntryDTO[],
  _businessDate?: string
): Promise<NotebookEntryDTO[]> {
  const finishedBillIds = await getFinishedBillIdSet(
    collectBillIdsFromEntryDtos(entries)
  );

  return entries.map((entry) =>
    enrichEntryDTOWithEditLock(entry, finishedBillIds)
  );
}

export async function getEntryEditLockFailure(
  entry: Pick<
    INotebookEntry,
    | "status"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "contributors"
    | "billId"
  >
): Promise<string | null> {
  if (!entry.contributors?.length && (await isEntryOnFinishedVisit(entry))) {
    return VISIT_FINISHED_LOCK_MESSAGE;
  }

  const finishedBillIds = entry.contributors?.length
    ? await getFinishedBillIdSet(collectBillIdsFromEntries([entry]))
    : new Set<string>();

  const locked = isNotebookEntryEditLocked({
    status: entry.status,
    visitStatus: undefined,
    paidAmount: entry.paidAmount ?? 0,
    balanceCollectedAmount: entry.balanceCollectedAmount ?? 0,
    contributors: entry.contributors?.map((contributor) => ({
      status: contributor.status,
      visitStatus:
        contributor.billId &&
        finishedBillIds.has(contributor.billId.toString())
          ? ("FINISHED" as const)
          : ("ACTIVE" as const),
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
  > & { visitStatus?: NotebookEntryDTO["visitStatus"] }
): string | null {
  if (entry.contributors && entry.contributors.length > 0) {
    const contributors = entry.contributors.map((contributor) => ({
      status: contributor.status,
      visitStatus: (contributor as { visitStatus?: NotebookEntryDTO["visitStatus"] })
        .visitStatus,
      paidAmount: contributor.paidAmount,
      balanceCollectedAmount: contributor.balanceCollectedAmount,
    }));

    return entryBlocksCustomerReassignment({
      status: entry.status,
      visitStatus: entry.visitStatus,
      paidAmount: entry.paidAmount,
      balanceCollectedAmount: entry.balanceCollectedAmount,
      contributors,
    })
      ? ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE
      : null;
  }

  if (entry.visitStatus === "FINISHED") {
    return VISIT_FINISHED_LOCK_MESSAGE;
  }

  return entryBlocksCustomerReassignment(entry)
    ? ENTRY_CUSTOMER_REASSIGN_BLOCKED_MESSAGE
    : null;
}

export async function getCustomerReassignmentFailureForEntry(
  entry: Pick<
    INotebookEntry,
    | "status"
    | "paidAmount"
    | "balanceCollectedAmount"
    | "contributors"
    | "billId"
  >
): Promise<string | null> {
  if (await isEntryOnFinishedVisit(entry)) {
    return VISIT_FINISHED_LOCK_MESSAGE;
  }

  return getCustomerReassignmentFailure(entry);
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
