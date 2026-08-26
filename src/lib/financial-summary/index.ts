/**
 * Financial Summary Engine
 *
 * Architectural boundary (docs/00-business-rules.md §11 — Financial Summary Principle):
 *
 * During an OPEN Business Day, operational modules may compute temporary values
 * to support cashier workflows.
 *
 * After a Business Day is CLOSED, all financial views must derive their values
 * from the immutable Business Day Final Summary produced by this module.
 * No module may implement its own Bill, Received, Due, Cash, GPay, or Outstanding
 * aggregation logic for finalized data.
 *
 * One finalized Business Day → one Final Summary → many read-only views.
 */

export {
  buildBusinessDayCloseSummary,
  buildBusinessDayCloseSummaryForId,
} from "@/lib/business-day/close-summary";

export { attributePaymentCollections } from "@/lib/business-day/payment-collections";

export {
  accumulateAttributedPayment,
  emptyAttributedPaymentSummary,
  type AttributedPaymentSummary,
} from "@/lib/financial-summary/accumulate-payment";

export { rollupAttributedChargeLines } from "@/lib/financial-summary/charge-line-rollup";

export {
  customerEntryReceived,
  customerEntryShare,
} from "@/lib/financial-summary/customer-share";

export {
  buildBusinessDayFinalSummaryPayload,
  type BusinessDayFinalSummaryPayload,
} from "@/lib/financial-summary/build-final-summary";

export {
  deleteBusinessDayFinalSummary,
  getBusinessDayFinalSummary,
  insertBusinessDayFinalSummaryInSession,
  listBusinessDayFinalSummaries,
  requireBusinessDayFinalSummary,
} from "@/lib/financial-summary/final-summary-store";

export {
  applyFinancialCorrections,
  type FinancialCorrectionOverlayInput,
} from "@/lib/financial-summary/apply-corrections";

export {
  getCorrectedBusinessDayFinalSummary,
  listCorrectedBusinessDayFinalSummaries,
  requireCorrectedBusinessDayFinalSummary,
} from "@/lib/financial-summary/corrected-summary";
