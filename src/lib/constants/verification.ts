export const VERIFICATION_METHODS = ["CARD", "PHONE"] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export function verificationMethodLabel(method: VerificationMethod): string {
  return method === "CARD" ? "CARD" : "PHONE";
}

/** When staff already opened the customer profile, skip manual lookup. */
export function verificationMethodForKnownCustomer(
  customer: { walletEnabled: boolean; cardId?: string | null }
): VerificationMethod {
  const cardId = customer.cardId?.trim();
  if (customer.walletEnabled && cardId) {
    return "CARD";
  }
  return "PHONE";
}
