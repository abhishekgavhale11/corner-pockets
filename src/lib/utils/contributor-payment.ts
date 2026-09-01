import { framePaymentStatus } from "@/lib/utils/frame-payment";

export const RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE =
  "Please select Cash or GPay for the received amount.";

export type ExplicitPaymentMethod = "CASH" | "GPAY";

/**
 * Payment mode stored for a contributor.
 * Cash/GPay only when Received > 0 and the cashier explicitly selected one.
 * Never defaults a missing mode to Cash.
 */
export function explicitPaymentMethod(
  paidAmount: number,
  paymentMethod: string | null | undefined
): ExplicitPaymentMethod | undefined {
  if (paidAmount <= 0) return undefined;
  if (paymentMethod === "CASH" || paymentMethod === "GPAY") {
    return paymentMethod;
  }
  return undefined;
}

export function contributorReceivedPaymentModeError(
  paidAmount: number,
  paymentMethod: string | null | undefined
): string | null {
  if (paidAmount > 0 && !explicitPaymentMethod(paidAmount, paymentMethod)) {
    return RECEIVED_PAYMENT_MODE_REQUIRED_MESSAGE;
  }
  return null;
}

export function contributorPersistedPayment(input: {
  amount: number;
  paidAmount: number;
  paymentMethod?: string | null;
}):
  | {
      ok: true;
      paidAmount: number;
      status: "PENDING" | "PAID";
      paymentMethod?: ExplicitPaymentMethod;
    }
  | { ok: false; error: string } {
  const paidAmount = Math.max(0, Math.round(input.paidAmount));
  const modeError = contributorReceivedPaymentModeError(
    paidAmount,
    input.paymentMethod
  );
  if (modeError) {
    return { ok: false, error: modeError };
  }

  const paymentMethod = explicitPaymentMethod(paidAmount, input.paymentMethod);
  return {
    ok: true,
    paidAmount,
    status: framePaymentStatus(input.amount, paidAmount),
    ...(paymentMethod ? { paymentMethod } : {}),
  };
}
