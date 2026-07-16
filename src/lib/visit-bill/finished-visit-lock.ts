import mongoose from "mongoose";
import type { VisitStatus } from "@/lib/constants/visit-bill";
import type { NotebookEntryDTO } from "@/types";
import { getBusinessDate } from "@/lib/utils/business-date";
import {
  VISIT_FINISHED_CHECKOUT_MESSAGE,
  VISIT_FINISHED_LOCK_MESSAGE,
} from "@/lib/visit-bill/entry-edit-lock-utils";
import Visit from "@/models/Visit";

export {
  VISIT_FINISHED_CHECKOUT_MESSAGE,
  VISIT_FINISHED_LOCK_MESSAGE,
} from "@/lib/visit-bill/entry-edit-lock-utils";
export async function getFinishedBillIdSet(
  billIds: Iterable<string>
): Promise<Set<string>> {
  const unique = [...new Set([...billIds].filter(Boolean))];
  if (unique.length === 0) {
    return new Set();
  }

  const visits = await Visit.find({
    billId: {
      $in: unique.map((id) => new mongoose.Types.ObjectId(id)),
    },
    status: "FINISHED",
  })
    .select("billId")
    .lean();

  return new Set(visits.map((visit) => visit.billId.toString()));
}

export function collectBillIdsFromEntryDtos(
  entries: Array<
    Pick<NotebookEntryDTO, "billId" | "contributors">
  >
): string[] {
  const billIds = new Set<string>();

  for (const entry of entries) {
    if (entry.billId) {
      billIds.add(entry.billId);
    }
    for (const contributor of entry.contributors ?? []) {
      if (contributor.billId) {
        billIds.add(contributor.billId);
      }
    }
  }

  return [...billIds];
}

export async function getFinishedCustomerIdSetForDate(
  customerIds: Iterable<string>,
  businessDate: string
): Promise<Set<string>> {
  const unique = [...new Set([...customerIds].filter(Boolean))];
  if (unique.length === 0) {
    return new Set();
  }

  const visits = await Visit.find({
    customerId: {
      $in: unique.map((id) => new mongoose.Types.ObjectId(id)),
    },
    businessDate,
    status: "FINISHED",
  })
    .select("customerId")
    .lean();

  return new Set(visits.map((visit) => visit.customerId.toString()));
}

export function collectCustomerIdsFromEntryDtos(
  entries: Array<
    Pick<NotebookEntryDTO, "customerId" | "contributors">
  >
): string[] {
  const customerIds = new Set<string>();

  for (const entry of entries) {
    if (entry.customerId) {
      customerIds.add(entry.customerId);
    }
    for (const contributor of entry.contributors ?? []) {
      if (contributor.customerId) {
        customerIds.add(contributor.customerId);
      }
    }
  }

  return [...customerIds];
}

export function resolveEntryVisitStatus(
  entry: Pick<NotebookEntryDTO, "billId" | "visitId" | "contributors" | "customerId">,
  finishedBillIds: Set<string>
): VisitStatus | undefined {
  const billIds = new Set<string>();
  if (entry.billId) {
    billIds.add(entry.billId);
  }
  for (const contributor of entry.contributors ?? []) {
    if (contributor.billId) {
      billIds.add(contributor.billId);
    }
  }

  if (billIds.size === 0) {
    return undefined;
  }

  if ([...billIds].every((billId) => finishedBillIds.has(billId))) {
    return "FINISHED";
  }

  return "ACTIVE";
}

export async function getFinishedVisitLockFailureForEntries(
  entries: Array<{
    billId?: mongoose.Types.ObjectId | string | null;
    customerId?: mongoose.Types.ObjectId | string | null;
    createdAt?: Date;
    contributors?: Array<{
      billId?: mongoose.Types.ObjectId | string | null;
      customerId?: mongoose.Types.ObjectId | string | null;
    }>;
  }>
): Promise<string | null> {
  for (const entry of entries) {
    if (await isEntryOnFinishedVisit(entry)) {
      return VISIT_FINISHED_LOCK_MESSAGE;
    }
  }
  return null;
}

export async function getCustomerActiveVisitCheckoutFailure(
  customerId: string,
  businessDate?: string
): Promise<string | null> {
  const date = businessDate ?? getBusinessDate();
  const activeVisit = await Visit.findOne({
    customerId: new mongoose.Types.ObjectId(customerId),
    businessDate: date,
    status: "ACTIVE",
  }).lean();

  if (!activeVisit) {
    return VISIT_FINISHED_CHECKOUT_MESSAGE;
  }

  return null;
}

export async function isEntryOnFinishedVisit(entry: {
  billId?: mongoose.Types.ObjectId | string | null;
  customerId?: mongoose.Types.ObjectId | string | null;
  createdAt?: Date;
  contributors?: Array<{
    billId?: mongoose.Types.ObjectId | string | null;
    customerId?: mongoose.Types.ObjectId | string | null;
  }>;
}): Promise<boolean> {
  const billIds: string[] = [];

  if (entry.billId) {
    billIds.push(entry.billId.toString());
  }

  for (const contributor of entry.contributors ?? []) {
    if (contributor.billId) {
      billIds.push(contributor.billId.toString());
    }
  }

  if (billIds.length > 0) {
    const finishedBillIds = await getFinishedBillIdSet(billIds);
    return billIds.some((billId) => finishedBillIds.has(billId));
  }

  return false;
}
