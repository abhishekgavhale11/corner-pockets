import { attributePaymentCollections } from "@/lib/business-day/payment-collections";
import { frameDueAmount, framePaidAmount } from "@/lib/utils/frame-payment";

/**
 * Shared Bill / Received / Cash / GPay / Outstanding Created rollup for
 * charge lines (History settlements, section insights, category summaries).
 *
 * Formula ownership: Financial Summary Engine.
 * Cash / GPay labeling: attributePaymentCollections only.
 */
export function rollupAttributedChargeLines(
  lines: Array<{
    amount: number;
    paidAmount: number;
    paymentMethod?: string | null;
    paymentAllocations?: Array<{
      paymentMethod: string;
      amount: number;
    }> | null;
  }>
): {
  bill: number;
  received: number;
  cashCollection: number;
  gpayCollection: number;
  outstandingCreated: number;
} {
  let bill = 0;
  let received = 0;
  let cashCollection = 0;
  let gpayCollection = 0;

  for (const line of lines) {
    bill += line.amount;
    const paid = framePaidAmount(line.paidAmount);
    received += paid;
    const portion = attributePaymentCollections({
      paidAmount: paid,
      paymentMethod: line.paymentMethod,
      paymentAllocations: line.paymentAllocations,
    });
    cashCollection += portion.cash;
    gpayCollection += portion.gpay;
  }

  return {
    bill,
    received,
    cashCollection,
    gpayCollection,
    outstandingCreated: frameDueAmount(bill, received),
  };
}
