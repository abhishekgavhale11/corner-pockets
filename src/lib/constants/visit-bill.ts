export const VISIT_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const BILL_STATUSES = [
  "ACTIVE",
  "DUE",
  "PAID",
  "OUTSTANDING",
  "SETTLED",
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];
