import type { RemainderPaymentMethod } from "@/lib/wallet/wallet-payment-math";

export const WALLET_PAYMENT_PURPOSES = [
  "FRAME_PAYMENT",
  "CAFE_PAYMENT",
  "OUTSTANDING_COLLECTION",
  "OTHER",
] as const;

export type WalletPaymentPurpose = (typeof WALLET_PAYMENT_PURPOSES)[number];

export type WalletPaymentLineItem = {
  label: string;
  quantity?: number;
};

/** Stored on Transaction for Customer Timeline (presentation only). */
export type WalletPaymentContext = {
  purpose: WalletPaymentPurpose;
  /** Amount being settled in this payment (Received / Outstanding Paid). */
  billAmount: number;
  /** Wallet debited in this transaction. */
  walletUsed: number;
  /** Cash/GPay portion of the bill after wallet. */
  remainderAmount: number;
  remainderMethod?: RemainderPaymentMethod;
  totalPaid: number;
  lines?: WalletPaymentLineItem[];
  businessDayId?: string;
};

export function walletPaymentPurposeLabel(
  purpose: WalletPaymentPurpose | string | undefined
): string {
  switch (purpose) {
    case "FRAME_PAYMENT":
      return "Frame Payment";
    case "CAFE_PAYMENT":
      return "Cafe Payment";
    case "OUTSTANDING_COLLECTION":
      return "Outstanding Collection";
    case "OTHER":
      return "Wallet Payment";
    default:
      return "Wallet Payment";
  }
}

export function buildWalletPaymentContext(input: {
  purpose: WalletPaymentPurpose;
  billAmount: number;
  /** This debit amount (txn). */
  walletUsed: number;
  /** Total wallet applied to the bill after this debit (for remainder calc). */
  totalWalletApplied?: number;
  remainderMethod?: RemainderPaymentMethod | "" | null;
  lines?: WalletPaymentLineItem[];
  businessDayId?: string;
}): WalletPaymentContext {
  const billAmount = Math.max(0, Math.round(input.billAmount));
  const walletUsed = Math.max(0, Math.round(input.walletUsed));
  const totalWallet = Math.max(
    walletUsed,
    Math.round(input.totalWalletApplied ?? walletUsed)
  );
  const remainderAmount = Math.max(0, billAmount - totalWallet);
  const remainderMethod =
    remainderAmount > 0 &&
    (input.remainderMethod === "CASH" || input.remainderMethod === "GPAY")
      ? input.remainderMethod
      : undefined;

  return {
    purpose: input.purpose,
    billAmount,
    walletUsed,
    remainderAmount,
    remainderMethod,
    totalPaid: billAmount,
    ...(input.lines && input.lines.length > 0 ? { lines: input.lines } : {}),
    ...(input.businessDayId ? { businessDayId: input.businessDayId } : {}),
  };
}
