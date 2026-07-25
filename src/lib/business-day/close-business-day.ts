import mongoose from "mongoose";
import BusinessDay from "@/models/BusinessDay";
import Outstanding from "@/models/Outstanding";
import { toBusinessDayDTO } from "@/lib/mappers/business-day";
import { validateBusinessDayClosePreflight } from "@/lib/business-day/close-preflight";
import { validateBusinessDayCloseFinancialProof } from "@/lib/business-day/close-financial-proof";
import { validateBusinessDayCloseOutstandingProof } from "@/lib/business-day/close-outstanding-proof";
import { getBusinessDayHistoryDetail } from "@/lib/business-day/history";
import {
  buildOutstandingCandidatesForBusinessDay,
  insertOutstandingCandidatesInSession,
} from "@/lib/outstanding/generate-on-close";
import type { BusinessDayCloseExecutionResult } from "@/types";

function formatPreflightAffected(
  issues: {
    validation: string;
    affectedRecords: { recordType: string; recordId: string }[];
  }[]
): string[] {
  return issues.flatMap((issue) =>
    issue.affectedRecords.map(
      (record) => `${issue.validation}:${record.recordType}:${record.recordId}`
    )
  );
}

/**
 * Phase 4 — Safe Business Day Close.
 *
 * Gates: Phase 1A → 1B → 2 (no writes).
 * Then one MongoDB transaction: Outstanding insert + mark CLOSED.
 * History is the CLOSED Business Day audit view (no separate History document).
 */
export async function closeBusinessDay(input: {
  closedBy: string;
}): Promise<BusinessDayCloseExecutionResult> {
  const openDay = await BusinessDay.findOne({ status: "OPEN" });

  if (!openDay) {
    const latest = await BusinessDay.findOne()
      .sort({ businessDayNumber: -1 })
      .lean();
    if (latest && latest.status === "CLOSED") {
      return {
        status: "ALREADY_CLOSED",
        day: toBusinessDayDTO(latest),
        reason: "Business Day already closed.",
      };
    }
    return {
      status: "FAIL",
      stage: "IDEMPOTENCY",
      reason: "No OPEN Business Day to close.",
    };
  }

  if (openDay.status === "CLOSED") {
    return {
      status: "ALREADY_CLOSED",
      day: toBusinessDayDTO(openDay),
      reason: "Business Day already closed.",
    };
  }

  const businessDayId = openDay._id;
  const businessDayIdStr = businessDayId.toString();

  // --- Phase 1A (read-only) ---
  const preflight = await validateBusinessDayClosePreflight(businessDayIdStr);
  if (preflight.status === "FAIL") {
    return {
      status: "FAIL",
      stage: "PREFLIGHT",
      reason: preflight.issues[0]?.reason ?? "Business Day Close Preflight failed.",
      validation: preflight.issues[0]?.validation,
      affectedRecords: formatPreflightAffected(preflight.issues),
      details: preflight.issues,
    };
  }

  // --- Phase 1B (read-only) ---
  const financialProof =
    await validateBusinessDayCloseFinancialProof(businessDayIdStr);
  if (financialProof.status === "FAIL") {
    return {
      status: "FAIL",
      stage: "FINANCIAL_PROOF",
      reason:
        financialProof.issues[0]?.reason ?? "Business Day Financial Proof failed.",
      validation: financialProof.issues[0]?.invariant,
      affectedRecords: financialProof.issues.flatMap(
        (issue) => issue.affectedCustomers
      ),
      details: financialProof.issues,
    };
  }

  // --- Phase 2 (read-only) ---
  const outstandingProof =
    await validateBusinessDayCloseOutstandingProof(businessDayIdStr);
  if (outstandingProof.status === "FAIL") {
    return {
      status: "FAIL",
      stage: "OUTSTANDING_PROOF",
      reason:
        outstandingProof.issues[0]?.rootCause ??
        outstandingProof.issues[0]?.validation ??
        "Outstanding Candidate Proof failed.",
      validation: outstandingProof.issues[0]?.validation,
      affectedRecords: outstandingProof.issues.flatMap(
        (issue) => issue.affectedRecords
      ),
      details: outstandingProof.issues,
    };
  }

  const candidates =
    await buildOutstandingCandidatesForBusinessDay(businessDayId);
  const expectedOutstandingCount = candidates.length;

  // --- Transaction ---
  const dbSession = await mongoose.startSession();
  let closedDayDto = toBusinessDayDTO(openDay);

  try {
    await dbSession.withTransaction(async () => {
      const day = await BusinessDay.findById(businessDayId).session(dbSession);
      if (!day) {
        throw new Error("Business Day not found during close transaction.");
      }

      if (day.status === "CLOSED") {
        const err = new Error("Business Day already closed.");
        (err as Error & { code?: string }).code = "ALREADY_CLOSED";
        throw err;
      }

      if (day.status !== "OPEN") {
        throw new Error(
          `Business Day status is ${day.status}; only OPEN days can be closed.`
        );
      }

      const existingOutstanding = await Outstanding.countDocuments({
        businessDayId,
      }).session(dbSession);

      if (existingOutstanding > 0) {
        throw new Error(
          `Cannot close: ${existingOutstanding} Outstanding record(s) already exist for this still-OPEN Business Day. Resolve the partial state before closing.`
        );
      }

      await insertOutstandingCandidatesInSession({
        businessDayId,
        openedAt: day.openedAt,
        businessDate: day.businessDate,
        candidates,
        session: dbSession,
      });

      // History is produced by marking the Business Day CLOSED (audit reads CLOSED days).
      day.status = "CLOSED";
      day.closedAt = new Date();
      day.closedBy = input.closedBy;
      await day.save({ session: dbSession });

      closedDayDto = toBusinessDayDTO(day);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Business Day Close transaction failed.";
    if (
      message === "Business Day already closed." ||
      (error as { code?: string })?.code === "ALREADY_CLOSED"
    ) {
      const fresh = await BusinessDay.findById(businessDayId).lean();
      if (fresh && fresh.status === "CLOSED") {
        return {
          status: "ALREADY_CLOSED",
          day: toBusinessDayDTO(fresh),
          reason: "Business Day already closed.",
        };
      }
    }
    return {
      status: "FAIL",
      stage: "TRANSACTION",
      reason: message,
    };
  } finally {
    await dbSession.endSession();
  }

  // --- Post-commit validation ---
  const verifiedDay = await BusinessDay.findById(businessDayId).lean();
  if (!verifiedDay || verifiedDay.status !== "CLOSED") {
    return {
      status: "CRITICAL",
      stage: "POST_COMMIT_VALIDATION",
      businessDayId: businessDayIdStr,
      reason:
        "CRITICAL: Close transaction reported success but Business Day status is not CLOSED.",
    };
  }

  const outstandingCount = await Outstanding.countDocuments({ businessDayId });
  if (outstandingCount !== expectedOutstandingCount) {
    return {
      status: "CRITICAL",
      stage: "POST_COMMIT_VALIDATION",
      businessDayId: businessDayIdStr,
      reason: `CRITICAL: Expected ${expectedOutstandingCount} Outstanding record(s) after close, found ${outstandingCount}.`,
    };
  }

  const history = await getBusinessDayHistoryDetail(businessDayIdStr);
  if (!history) {
    return {
      status: "CRITICAL",
      stage: "POST_COMMIT_VALIDATION",
      businessDayId: businessDayIdStr,
      reason:
        "CRITICAL: Business Day is CLOSED but Business Day History audit view is unavailable.",
    };
  }

  return {
    status: "SUCCESS",
    day: toBusinessDayDTO(verifiedDay),
    outstandingCreated: outstandingCount,
  };
}

/** Formats a close execution failure for ActionResult.error strings. */
export function formatBusinessDayCloseFailure(
  result: Extract<
    BusinessDayCloseExecutionResult,
    { status: "FAIL" | "CRITICAL" }
  >
): string {
  const parts = [`[${result.stage}] ${result.reason}`];
  if ("validation" in result && result.validation) {
    parts.push(`Validation: ${result.validation}`);
  }
  if (
    "affectedRecords" in result &&
    result.affectedRecords &&
    result.affectedRecords.length > 0
  ) {
    const sample = result.affectedRecords.slice(0, 5).join("; ");
    const more =
      result.affectedRecords.length > 5
        ? ` (+${result.affectedRecords.length - 5} more)`
        : "";
    parts.push(`Affected: ${sample}${more}`);
  }
  return parts.join(" | ");
}
