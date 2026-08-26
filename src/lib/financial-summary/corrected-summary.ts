import type { Types } from "mongoose";
import {
  getBusinessDayFinalSummary,
  listBusinessDayFinalSummaries,
  requireBusinessDayFinalSummary,
} from "@/lib/financial-summary/final-summary-store";
import { applyFinancialCorrections } from "@/lib/financial-summary/apply-corrections";
import {
  listFinancialCorrectionsByAffectedDayIds,
  listFinancialCorrectionsForAffectedDay,
  toOverlayInput,
} from "@/lib/financial-corrections/queries";
import type { BusinessDayFinalSummaryPayload } from "@/lib/financial-summary/build-final-summary";

/**
 * Original close snapshot + applicable FinancialCorrection rows.
 * Does not read or write BusinessDayFinalSummary documents.
 */
export async function requireCorrectedBusinessDayFinalSummary(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayFinalSummaryPayload> {
  const original = await requireBusinessDayFinalSummary(businessDayId);
  const corrections = await listFinancialCorrectionsForAffectedDay(businessDayId);
  return applyFinancialCorrections(original, corrections.map(toOverlayInput));
}

export async function getCorrectedBusinessDayFinalSummary(
  businessDayId: Types.ObjectId | string
): Promise<BusinessDayFinalSummaryPayload | null> {
  const original = await getBusinessDayFinalSummary(businessDayId);
  if (!original) return null;
  const corrections = await listFinancialCorrectionsForAffectedDay(businessDayId);
  return applyFinancialCorrections(original, corrections.map(toOverlayInput));
}

export async function listCorrectedBusinessDayFinalSummaries(
  businessDayIds: Array<Types.ObjectId | string>
): Promise<Map<string, BusinessDayFinalSummaryPayload>> {
  const originals = await listBusinessDayFinalSummaries(businessDayIds);
  const correctionsByDay =
    await listFinancialCorrectionsByAffectedDayIds(businessDayIds);

  const result = new Map<string, BusinessDayFinalSummaryPayload>();
  for (const [dayId, payload] of originals) {
    const corrections = correctionsByDay.get(dayId) ?? [];
    result.set(
      dayId,
      applyFinancialCorrections(payload, corrections.map(toOverlayInput))
    );
  }
  return result;
}
