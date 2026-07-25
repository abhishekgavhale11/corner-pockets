/**
 * Attribute a paid amount into Cash / GPay / Wallet buckets for presentation.
 * Does not change Bill / Received / Due math — only how Received is labeled.
 *
 * Rules:
 * - Exclusive WALLET → all paid is Wallet
 * - Cash/GPay with walletAmount → wallet portion to Wallet, remainder to Cash/GPay
 * - Cash/GPay alone → full paid to that method
 */
export function attributePaymentCollections(input: {
  paidAmount: number;
  paymentMethod?: string | null;
  walletAmount?: number | null;
}): { cash: number; gpay: number; wallet: number } {
  const paid = Math.max(0, Math.round(input.paidAmount));
  if (paid <= 0) {
    return { cash: 0, gpay: 0, wallet: 0 };
  }

  if (input.paymentMethod === "WALLET") {
    return { cash: 0, gpay: 0, wallet: paid };
  }

  const wallet = Math.min(
    paid,
    Math.max(0, Math.round(input.walletAmount ?? 0))
  );
  const remainder = paid - wallet;

  if (input.paymentMethod === "CASH") {
    return { cash: remainder, gpay: 0, wallet };
  }
  if (input.paymentMethod === "GPAY") {
    return { cash: 0, gpay: remainder, wallet };
  }

  // No Cash/GPay mode — still surface wallet portion when present.
  return { cash: 0, gpay: 0, wallet };
}
