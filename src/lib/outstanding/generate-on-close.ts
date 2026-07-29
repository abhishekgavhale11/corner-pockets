import type { OutstandingSourceType } from "@/lib/constants/outstanding";
import {
  BUSINESS_DAY_OUTSTANDING_SOURCE_TYPES,
  type BusinessDayOutstandingSourceType,
} from "@/lib/constants/outstanding";
import { loadFinancialProofSnapshot } from "@/lib/business-day/close-financial-proof";
import { nextOutstandingNumberFromDb } from "@/lib/outstanding/queries";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import Outstanding from "@/models/Outstanding";
import mongoose from "mongoose";

export type OutstandingCandidate = {
  customerId: string;
  sourceType: BusinessDayOutstandingSourceType;
  sourceRecordId: string;
  dueAmount: number;
};

function asBusinessDaySourceType(
  sourceType: OutstandingSourceType | string
): BusinessDayOutstandingSourceType {
  if (
    (BUSINESS_DAY_OUTSTANDING_SOURCE_TYPES as readonly string[]).includes(
      sourceType
    )
  ) {
    return sourceType as BusinessDayOutstandingSourceType;
  }
  throw new Error(`Invalid Outstanding source for Business Day close: ${sourceType}`);
}

/**
 * Builds Outstanding rows that WOULD be inserted on close.
 * Does not write to the database.
 *
 * One candidate per customer for the Business Day (Due aggregated across
 * Frames + Cafe). Source fields keep a single provenance pointer for audit —
 * cashiers never collect by individual source line.
 *
 * Candidates are derived from the Phase 1B Financial Proof ownership lines.
 * No independent Bill / Received / Due math lives here.
 */
export async function buildOutstandingCandidatesForBusinessDay(
  businessDayId: mongoose.Types.ObjectId
): Promise<OutstandingCandidate[]> {
  const loaded = await loadFinancialProofSnapshot(businessDayId.toString());

  if (!loaded.ok) {
    const reason =
      loaded.result.status === "FAIL"
        ? loaded.result.issues[0]?.reason
        : undefined;
    throw new Error(
      reason ??
        "Cannot build Outstanding candidates: Financial Proof snapshot unavailable."
    );
  }

  type Agg = {
    dueAmount: number;
    sourceType: BusinessDayOutstandingSourceType;
    sourceRecordId: string;
  };

  const byCustomer = new Map<string, Agg>();

  for (const line of loaded.snapshot.ownershipLines) {
    if (!line.customerId) continue;
    if (line.due <= 0) continue;

    const existing = byCustomer.get(line.customerId);
    if (existing) {
      existing.dueAmount += line.due;
      continue;
    }

    byCustomer.set(line.customerId, {
      dueAmount: line.due,
      sourceType: asBusinessDaySourceType(line.sourceType),
      sourceRecordId: line.sourceRecordId,
    });
  }

  const candidates: OutstandingCandidate[] = [];
  for (const [customerId, agg] of byCustomer) {
    candidates.push({
      customerId,
      sourceType: agg.sourceType,
      sourceRecordId: agg.sourceRecordId,
      dueAmount: agg.dueAmount,
    });
  }

  return candidates;
}

/**
 * Inserts Outstanding candidates inside an existing MongoDB session/transaction.
 * Does not perform Financial Proof math — candidates must already be proven.
 */
export async function insertOutstandingCandidatesInSession(input: {
  businessDayId: mongoose.Types.ObjectId;
  openedAt: Date;
  businessDate?: Date | null;
  candidates: OutstandingCandidate[];
  session: mongoose.ClientSession;
}): Promise<number> {
  const { businessDayId, candidates, session } = input;

  if (candidates.length === 0) {
    return 0;
  }

  let nextNumber = await nextOutstandingNumberFromDb(session);
  const businessDate = resolveBusinessDate(input.businessDate, input.openedAt);

  const docs = candidates.map((line) => ({
    outstandingNumber: nextNumber++,
    customerId: new mongoose.Types.ObjectId(line.customerId),
    businessDayId,
    businessDate,
    sourceType: line.sourceType,
    sourceRecordId: new mongoose.Types.ObjectId(line.sourceRecordId),
    originalAmount: line.dueAmount,
    remainingAmount: line.dueAmount,
    status: "PENDING" as const,
  }));

  await Outstanding.insertMany(docs, { session });
  return docs.length;
}
