/**
 * Per-frame payment: Due is always calculated, never stored.
 *
 * Financial Proof Received (Frames) =
 *   paidAmount + balanceCollectedAmount
 *
 * Due = Amount − Received
 */

/** Counter Cash/GPay portion only. */
export function framePaidAmount(paidAmount?: number | null): number {
  return Math.max(0, paidAmount ?? 0);
}

/**
 * Edit-dialog default for Received.
 * Unpaid bills open with Received = Amount so the cashier can pick Cash/GPay and save.
 * Existing Received (> 0) is preserved.
 */
export function defaultReceivedForEdit(
  amount: number,
  paidAmount?: number | null
): string {
  const paid = framePaidAmount(paidAmount);
  if (paid > 0) return String(paid);
  const bill = Math.max(0, Math.round(amount));
  return bill > 0 ? String(bill) : "0";
}

/**
 * Cafe Received is always typed by the cashier.
 * Do not pre-fill from Amount — items can still be added (e.g. cigarette +).
 */
export function cafeReceivedInput(paidAmount?: number | null): string {
  const paid = framePaidAmount(paidAmount);
  return paid > 0 ? String(paid) : "";
}

/**
 * When Amount changes, keep Received in sync if it still matched the previous Amount
 * (full-payment default), so Quick amount changes stay one-tap friendly.
 */
export function syncReceivedWithAmountChange(input: {
  previousAmount: number;
  nextAmount: number;
  currentReceived: number;
}): string | null {
  const prev = Math.max(0, Math.round(input.previousAmount));
  const next = Math.max(0, Math.round(input.nextAmount));
  const received = Math.max(0, Math.round(input.currentReceived));
  if (received === prev && next !== prev) {
    return String(next);
  }
  return null;
}

/**
 * Full Received toward today's bill — matches Financial Proof / Close Summary.
 * balanceCollectedAmount = money applied via balance payments to open charges.
 */
export function frameReceivedAmount(
  paidAmount?: number | null,
  balanceCollectedAmount?: number | null
): number {
  return (
    framePaidAmount(paidAmount) + framePaidAmount(balanceCollectedAmount)
  );
}

/**
 * Due from Amount and total Received.
 * Prefer frameDueFromParts when both paid + balanceCollected are available.
 */
export function frameDueAmount(amount: number, received = 0): number {
  return Math.max(0, amount - (received ?? 0));
}

/** Due = Amount − (paidAmount + balanceCollectedAmount). */
export function frameDueFromParts(
  amount: number,
  paidAmount?: number | null,
  balanceCollectedAmount?: number | null
): number {
  return frameDueAmount(
    amount,
    frameReceivedAmount(paidAmount, balanceCollectedAmount)
  );
}

/** Status from per-entry payment (no settlement engine). Uses full Received. */
export function framePaymentStatus(
  amount: number,
  paidAmount = 0,
  balanceCollectedAmount = 0
): "PENDING" | "PAID" {
  return frameDueFromParts(amount, paidAmount, balanceCollectedAmount) <= 0
    ? "PAID"
    : "PENDING";
}
