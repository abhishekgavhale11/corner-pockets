export const OUTSTANDING_STATUSES = ["PENDING", "COLLECTED"] as const;
export type OutstandingStatus = (typeof OUTSTANDING_STATUSES)[number];

export const OUTSTANDING_SOURCE_TYPES = ["FRAME", "CAFE"] as const;
export type OutstandingSourceType = (typeof OUTSTANDING_SOURCE_TYPES)[number];

/** New collections: Cash or GPay only. WALLET may exist on historical records. */
export const OUTSTANDING_PAYMENT_METHODS = ["CASH", "GPAY"] as const;
export type OutstandingPaymentMethod =
  | (typeof OUTSTANDING_PAYMENT_METHODS)[number]
  | "WALLET";
