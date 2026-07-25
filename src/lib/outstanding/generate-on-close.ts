import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import Outstanding from "@/models/Outstanding";
import { loadFinancialProofSnapshot } from "@/lib/business-day/close-financial-proof";
import { nextOutstandingNumberFromDb } from "@/lib/outstanding/queries";
import { resolveBusinessDate } from "@/lib/utils/business-date";
import type { OutstandingSourceType } from "@/lib/constants/outstanding";

export type OutstandingCandidate = {
  customerId: string;
  sourceType: OutstandingSourceType;
  sourceRecordId: string;
  dueAmount: number;
};

/**
 * Builds Outstanding rows that WOULD be inserted on close.
 * Does not write to the database.
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

  const candidates: OutstandingCandidate[] = [];

  for (const line of loaded.snapshot.ownershipLines) {
    if (!line.customerId) continue;
    if (line.due <= 0) continue;

    candidates.push({
      customerId: line.customerId,
      sourceType: line.sourceType,
      sourceRecordId: line.sourceRecordId,
      dueAmount: line.due,
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
