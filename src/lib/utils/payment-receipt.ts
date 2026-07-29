import mongoose from "mongoose";

export type StaffReceiptActor = {
  id: string;
  username: string;
};

export type PaymentReceiptFields = {
  receivedByStaffId?: mongoose.Types.ObjectId;
  receivedByUsername?: string;
  receivedAt?: Date;
};

export function isReceiptPayment(
  method: string | null | undefined
): method is "CASH" | "GPAY" {
  return method === "CASH" || method === "GPAY";
}

/**
 * Stamp payment receipt metadata on the latest save.
 * Clears fields when the saved payment does not record received money.
 */
export function applyCashGpayReceipt(
  target: PaymentReceiptFields,
  actor: StaffReceiptActor,
  paymentMethod: string | null | undefined,
  receivedAmount: number
): void {
  if (receivedAmount > 0 && isReceiptPayment(paymentMethod)) {
    target.receivedByStaffId = new mongoose.Types.ObjectId(actor.id);
    target.receivedByUsername = actor.username;
    target.receivedAt = new Date();
    return;
  }

  target.receivedByStaffId = undefined;
  target.receivedByUsername = undefined;
  target.receivedAt = undefined;
}

export function paymentReceiptDtoFields(source: {
  receivedByStaffId?: { toString(): string } | null;
  receivedByUsername?: string | null;
  receivedAt?: Date | string | null;
}): {
  receivedByStaffId?: string;
  receivedByUsername?: string;
  receivedAt?: string;
} {
  const receivedAt =
    source.receivedAt instanceof Date
      ? source.receivedAt.toISOString()
      : source.receivedAt
        ? String(source.receivedAt)
        : undefined;

  return {
    ...(source.receivedByStaffId
      ? { receivedByStaffId: source.receivedByStaffId.toString() }
      : {}),
    ...(source.receivedByUsername
      ? { receivedByUsername: source.receivedByUsername }
      : {}),
    ...(receivedAt ? { receivedAt } : {}),
  };
}
