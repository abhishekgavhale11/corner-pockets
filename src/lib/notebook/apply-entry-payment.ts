import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import type { INotebookEntry } from "@/models/NotebookEntry";
import { framePaymentStatus } from "@/lib/utils/frame-payment";
import type { PaymentAllocation } from "@/lib/utils/payment-allocations";
import {
  applyCashGpayReceipt,
  type StaffReceiptActor,
} from "@/lib/utils/payment-receipt";

export function applySingleCustomerEntryPayment(
  entry: INotebookEntry,
  input: {
    paidAmount: number;
    paymentMethod?: NotebookPaymentMethod;
    paymentAllocations?: PaymentAllocation[];
  },
  actor: StaffReceiptActor
): void {
  const paidAmount = Math.round(input.paidAmount);
  entry.paidAmount = paidAmount;
  entry.status = framePaymentStatus(entry.amount, paidAmount);

  if (input.paymentAllocations?.length === 2) {
    entry.set(
      "paymentAllocations",
      input.paymentAllocations.map((row) => ({
        paymentMethod: row.paymentMethod,
        amount: row.amount,
      }))
    );
    entry.paymentMethod = undefined;
    applyCashGpayReceipt(
      entry,
      actor,
      input.paymentAllocations[0]?.paymentMethod,
      paidAmount
    );
    return;
  }

  entry.set("paymentAllocations", undefined);
  if (paidAmount > 0 && input.paymentMethod) {
    entry.paymentMethod = input.paymentMethod;
    applyCashGpayReceipt(entry, actor, input.paymentMethod, paidAmount);
    return;
  }

  entry.paymentMethod = undefined;
  applyCashGpayReceipt(entry, actor, undefined, paidAmount);
}
