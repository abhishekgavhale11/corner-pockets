export const REVERSAL_REASON_KEYS = [
  "WRONG_AMOUNT",
  "WRONG_CUSTOMER",
  "DUPLICATE",
  "CUSTOMER_DISPUTE",
  "OTHER",
] as const;

export type ReversalReasonKey = (typeof REVERSAL_REASON_KEYS)[number];

export const REVERSAL_REASONS: {
  key: ReversalReasonKey;
  label: string;
}[] = [
  { key: "WRONG_AMOUNT", label: "Wrong amount entered" },
  { key: "WRONG_CUSTOMER", label: "Wrong customer selected" },
  { key: "DUPLICATE", label: "Duplicate transaction" },
  { key: "CUSTOMER_DISPUTE", label: "Customer dispute" },
  { key: "OTHER", label: "Other" },
];

export function getReversalReasonLabel(
  key: ReversalReasonKey,
  otherText?: string
): string {
  if (key === "OTHER") {
    return otherText?.trim() ? `Other: ${otherText.trim()}` : "Other";
  }

  return REVERSAL_REASONS.find((reason) => reason.key === key)?.label ?? key;
}
