import { attributePaymentCollections } from "@/lib/business-day/payment-collections";

export type AttributedPaymentSummary = {
  cash: number;
  gpay: number;
  totalPaid: number;
};

/**
 * Accumulate Cash / GPay for a payment line into a shared summary bucket.
 * Uses attributePaymentCollections — the only Cash/GPay attribution path.
 */
export function accumulateAttributedPayment(
  summary: AttributedPaymentSummary,
  input: {
    paidAmount: number;
    paymentMethod?: string | null;
    paymentAllocations?: readonly {
      paymentMethod: string;
      amount: number;
    }[] | null;
  }
): void {
  const paid = Math.max(0, Math.round(input.paidAmount));
  if (paid <= 0) return;

  const portion = attributePaymentCollections({
    paidAmount: paid,
    paymentMethod: input.paymentMethod,
    paymentAllocations: input.paymentAllocations,
  });

  summary.cash += portion.cash;
  summary.gpay += portion.gpay;
  summary.totalPaid += portion.cash + portion.gpay;
}

export function emptyAttributedPaymentSummary(): AttributedPaymentSummary {
  return { cash: 0, gpay: 0, totalPaid: 0 };
}
