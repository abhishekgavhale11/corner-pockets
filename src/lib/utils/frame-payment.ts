/**
 * Per-frame payment: Due is always calculated, never stored.
 * Due = Amount − Paid Amount
 */
export function frameDueAmount(amount: number, paidAmount = 0): number {
  return Math.max(0, amount - (paidAmount ?? 0));
}

export function framePaidAmount(paidAmount?: number | null): number {
  return Math.max(0, paidAmount ?? 0);
}

/** Status from per-entry payment (no settlement engine). */
export function framePaymentStatus(
  amount: number,
  paidAmount = 0
): "PENDING" | "PAID" {
  return frameDueAmount(amount, paidAmount) <= 0 ? "PAID" : "PENDING";
}
