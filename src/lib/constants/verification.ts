export const VERIFICATION_METHODS = ["CARD", "PHONE"] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export function verificationMethodLabel(method: VerificationMethod): string {
  return method === "CARD" ? "CARD" : "PHONE";
}
