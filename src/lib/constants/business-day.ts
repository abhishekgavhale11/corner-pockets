export const BUSINESS_DAY_STATUSES = ["OPEN", "CLOSED"] as const;

export type BusinessDayStatus = (typeof BUSINESS_DAY_STATUSES)[number];

/** First calendar date allowed for Business Day financial operations (YYYY-MM-DD). */
export const BUSINESS_DAY_FINANCIAL_START_DATE = "2026-09-17";
