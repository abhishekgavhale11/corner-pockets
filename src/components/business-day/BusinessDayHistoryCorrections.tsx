import {
  AdjustmentActivityCard,
  CorrectionsSectionHeader,
  OriginalCloseAuditCard,
} from "@/components/business-day/history/CorrectionsAdjustmentsUi";
import type { FinancialCorrectionHistoryRowDTO } from "@/types";

interface BusinessDayHistoryCorrectionsProps {
  publicId: string;
  corrections: FinancialCorrectionHistoryRowDTO[];
  originalSummary?: {
    todaysBill: number;
    totalReceived: number;
    cashCollection: number;
    gpayCollection: number;
    outstandingCreated: number;
  };
}

export function BusinessDayHistoryCorrections({
  publicId,
  corrections,
  originalSummary,
}: BusinessDayHistoryCorrectionsProps) {
  if (corrections.length === 0) return null;

  return (
    <section className="space-y-2.5" aria-label={`Corrections & Adjustments for ${publicId}`}>
      <CorrectionsSectionHeader subtitle="Adjustment activity recorded after close. Original close is unchanged." />

      <AdjustmentActivityCard corrections={corrections} />

      {originalSummary ? (
        <OriginalCloseAuditCard summary={originalSummary} />
      ) : null}
    </section>
  );
}
