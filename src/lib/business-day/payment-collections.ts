/**
 * Attribute a paid amount into Cash / GPay buckets for presentation.
 * Does not change Bill / Received / Due math — only how Received is labeled.
 */
export function attributePaymentCollections(input: {
  paidAmount: number;
  paymentMethod?: string | null;
  paymentAllocations?: readonly {
    paymentMethod: string;
    amount: number;
  }[] | null;
}): { cash: number; gpay: number } {
  const paid = Math.max(0, Math.round(input.paidAmount));
  if (paid <= 0) {
    return { cash: 0, gpay: 0 };
  }

  if (input.paymentAllocations && input.paymentAllocations.length > 0) {
    let cash = 0;
    let gpay = 0;
    for (const row of input.paymentAllocations) {
      const amount = Math.max(0, Math.round(row.amount));
      if (row.paymentMethod === "CASH") {
        cash += amount;
      } else if (row.paymentMethod === "GPAY") {
        gpay += amount;
      }
    }
    return { cash, gpay };
  }

  if (input.paymentMethod === "CASH") {
    return { cash: paid, gpay: 0 };
  }
  if (input.paymentMethod === "GPAY") {
    return { cash: 0, gpay: paid };
  }

  return { cash: 0, gpay: 0 };
}
