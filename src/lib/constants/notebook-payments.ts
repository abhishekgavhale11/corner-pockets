export const NOTEBOOK_PAYMENT_METHODS = ["CASH", "GPAY", "WALLET"] as const;

export type NotebookPaymentMethod = (typeof NOTEBOOK_PAYMENT_METHODS)[number];

export const NOTEBOOK_ENTRY_STATUSES = [
  "PENDING",
  "PAID",
  "REVERSED",
  "CANCELLED",
] as const;

export type NotebookEntryStatus = (typeof NOTEBOOK_ENTRY_STATUSES)[number];

/** Entries that appear in Checkout and can be settled. */
export const CHECKOUT_ELIGIBLE_STATUSES = ["PENDING", "REVERSED"] as const;

export const NOTEBOOK_SETTLEMENT_STATUSES = ["COMPLETED", "REVERSED"] as const;

export type NotebookSettlementStatus =
  (typeof NOTEBOOK_SETTLEMENT_STATUSES)[number];

export const NOTEBOOK_REVERSAL_REASON_KEYS = [
  "WRONG_AMOUNT",
  "WRONG_CUSTOMER",
  "DUPLICATE",
  "CUSTOMER_DISPUTE",
  "OTHER",
] as const;

export type NotebookReversalReasonKey =
  (typeof NOTEBOOK_REVERSAL_REASON_KEYS)[number];

export const NOTEBOOK_REVERSAL_REASONS: {
  key: NotebookReversalReasonKey;
  label: string;
}[] = [
  { key: "WRONG_AMOUNT", label: "Wrong Amount" },
  { key: "WRONG_CUSTOMER", label: "Wrong Customer" },
  { key: "DUPLICATE", label: "Duplicate Entry" },
  { key: "CUSTOMER_DISPUTE", label: "Customer Dispute" },
  { key: "OTHER", label: "Other" },
];

export function getNotebookReversalReasonLabel(
  key: NotebookReversalReasonKey,
  otherText?: string
): string {
  if (key === "OTHER") {
    return otherText?.trim() ? `Other: ${otherText.trim()}` : "Other";
  }

  return (
    NOTEBOOK_REVERSAL_REASONS.find((reason) => reason.key === key)?.label ?? key
  );
}

export function paymentMethodLabel(method: NotebookPaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "GPAY":
      return "GPay";
    case "WALLET":
      return "Wallet";
  }
}
