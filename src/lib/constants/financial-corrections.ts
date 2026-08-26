export const FINANCIAL_CORRECTION_TYPES = [
  "MISSED_PAYMENT",
  "OUTSTANDING_CORRECTION",
] as const;

export type FinancialCorrectionType =
  (typeof FINANCIAL_CORRECTION_TYPES)[number];

export const FINANCIAL_CORRECTION_PAYMENT_METHODS = ["CASH", "GPAY"] as const;
export type FinancialCorrectionPaymentMethod =
  (typeof FINANCIAL_CORRECTION_PAYMENT_METHODS)[number];

/** Reporting bucket on a correction. Not a table/frame id. */
export const FINANCIAL_CORRECTION_SECTIONS = [
  "BIG_SNOOKER",
  "POOL_MINI",
  "CAFE",
] as const;

export type FinancialCorrectionSection =
  (typeof FINANCIAL_CORRECTION_SECTIONS)[number];

export const DEFAULT_FINANCIAL_CORRECTION_SECTION: FinancialCorrectionSection =
  "BIG_SNOOKER";

export const FINANCIAL_CORRECTION_SECTION_LABELS: Record<
  FinancialCorrectionSection,
  string
> = {
  BIG_SNOOKER: "Big Snooker",
  POOL_MINI: "Pool & Mini",
  CAFE: "Cafe",
};

export function isFinancialCorrectionSection(
  value: unknown
): value is FinancialCorrectionSection {
  return (
    typeof value === "string" &&
    (FINANCIAL_CORRECTION_SECTIONS as readonly string[]).includes(value)
  );
}

export function isMissedPaymentType(
  type: FinancialCorrectionType | string
): boolean {
  return type === "MISSED_PAYMENT";
}

export function isOutstandingCorrectionType(
  type: FinancialCorrectionType | string
): boolean {
  return type === "OUTSTANDING_CORRECTION";
}
