export const VISIT_STATUSES = ["ACTIVE", "FINISHED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const BILL_STATUSES = [
  "WORKING",
  "FINISHED",
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];
