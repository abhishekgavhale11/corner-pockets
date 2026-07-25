import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";

export type RemainderPaymentMethod = "CASH" | "GPAY";

/**
 * Wallet Used = min(Wallet Balance, Bill/Received Amount)
 * Remaining = Bill − Wallet Used
 *
 * Pure helpers — safe for client components (no MongoDB / Mongoose).
 */

export function computeWalletUsed(input: {
  paidAmount: number;
  useWallet: boolean;
  /** Available balance (include prior debit on this record when editing). */
  availableBalance: number;
}): number {
  if (!input.useWallet) return 0;
  const paid = Math.max(0, Math.round(input.paidAmount));
  const available = Math.max(0, Math.round(input.availableBalance));
  if (paid <= 0 || available <= 0) return 0;
  return Math.min(available, paid);
}

/**
 * Resolve stored paymentMethod + walletAmount for an operational payment.
 *
 * - No wallet → paymentMethod = Cash/GPay, walletAmount = 0
 * - Wallet covers full paid → paymentMethod = WALLET, walletAmount = paid
 * - Wallet + remainder → paymentMethod = Cash/GPay, walletAmount = wallet used
 */
export function resolveWalletPayment(input: {
  paidAmount: number;
  useWallet: boolean;
  availableBalance: number;
  /** Required when not fully covered by wallet (and when wallet is off). */
  remainderMethod?: RemainderPaymentMethod | "" | null;
}): {
  walletAmount: number;
  remainder: number;
  paymentMethod: NotebookPaymentMethod;
} {
  const paid = Math.max(0, Math.round(input.paidAmount));
  if (paid <= 0) {
    throw new Error("Received amount must be greater than zero");
  }

  const walletAmount = computeWalletUsed({
    paidAmount: paid,
    useWallet: input.useWallet,
    availableBalance: input.availableBalance,
  });
  const remainder = paid - walletAmount;

  if (remainder === 0) {
    return { walletAmount, remainder: 0, paymentMethod: "WALLET" };
  }

  if (input.remainderMethod !== "CASH" && input.remainderMethod !== "GPAY") {
    throw new Error(
      walletAmount > 0
        ? "Select Cash or GPay for the remaining amount"
        : "Select Cash or GPay"
    );
  }

  return {
    walletAmount,
    remainder,
    paymentMethod: input.remainderMethod,
  };
}

/**
 * @deprecated Prefer resolveWalletPayment — kept for call-site migration.
 */
export function resolveWalletDebitAmount(input: {
  paidAmount: number;
  paymentMethod?: NotebookPaymentMethod | "" | null;
  walletAmount?: number | null;
  useWallet?: boolean;
  availableBalance?: number;
}): number {
  const paid = Math.round(input.paidAmount);
  if (paid <= 0) return 0;

  if (
    input.useWallet !== undefined ||
    input.availableBalance !== undefined
  ) {
    return computeWalletUsed({
      paidAmount: paid,
      useWallet:
        input.useWallet ??
        (input.paymentMethod === "WALLET" ||
          (input.walletAmount != null && input.walletAmount > 0)),
      availableBalance: input.availableBalance ?? paid,
    });
  }

  if (input.paymentMethod === "WALLET") return paid;
  if (input.walletAmount != null && input.walletAmount > 0) {
    return Math.min(Math.round(input.walletAmount), paid);
  }
  return 0;
}

/** Cash/GPay remainder after a partial Wallet debit (for timeline). */
export function remainingPaymentMethodForDebit(
  walletAmount: number,
  paidAmount: number,
  paymentMethod?: NotebookPaymentMethod | "" | null
): RemainderPaymentMethod | undefined {
  const wallet = Math.round(walletAmount);
  const paid = Math.round(paidAmount);
  if (wallet <= 0 || wallet >= paid) return undefined;
  if (paymentMethod === "CASH" || paymentMethod === "GPAY") {
    return paymentMethod;
  }
  return undefined;
}

/** Parse useWallet flag from FormData / JSON. */
export function parseUseWalletFlag(
  raw: FormDataEntryValue | boolean | string | null | undefined,
  paymentMethod?: string | null,
  walletAmount?: number | null
): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  if (raw === "false" || raw === "0") return false;
  if (paymentMethod === "WALLET") return true;
  if (walletAmount != null && walletAmount > 0) return true;
  return false;
}
