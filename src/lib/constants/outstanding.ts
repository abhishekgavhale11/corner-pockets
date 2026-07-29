export const OUTSTANDING_STATUSES = ["PENDING", "COLLECTED"] as const;
export type OutstandingStatus = (typeof OUTSTANDING_STATUSES)[number];

/** FRAME / CAFE = Business Day close. OPENING = pre-CPOS migration baseline. */
export const OUTSTANDING_SOURCE_TYPES = ["FRAME", "CAFE", "OPENING"] as const;
export type OutstandingSourceType = (typeof OUTSTANDING_SOURCE_TYPES)[number];

export const BUSINESS_DAY_OUTSTANDING_SOURCE_TYPES = ["FRAME", "CAFE"] as const;
export type BusinessDayOutstandingSourceType =
  (typeof BUSINESS_DAY_OUTSTANDING_SOURCE_TYPES)[number];

/** New collections: Cash or GPay only. */
export const OUTSTANDING_PAYMENT_METHODS = ["CASH", "GPAY"] as const;
export type OutstandingPaymentMethod =
  (typeof OUTSTANDING_PAYMENT_METHODS)[number];

export function isOpeningOutstandingSource(
  sourceType: OutstandingSourceType | string | null | undefined
): boolean {
  return sourceType === "OPENING";
}

export function isBusinessDayOutstandingSource(
  sourceType: OutstandingSourceType | string | null | undefined
): boolean {
  return sourceType === "FRAME" || sourceType === "CAFE";
}
