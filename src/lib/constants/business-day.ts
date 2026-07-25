export const BUSINESS_DAY_STATUSES = ["OPEN", "CLOSED"] as const;

export type BusinessDayStatus = (typeof BUSINESS_DAY_STATUSES)[number];
