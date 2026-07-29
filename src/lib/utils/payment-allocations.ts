import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";

export type PaymentAllocation = {
  paymentMethod: NotebookPaymentMethod;
  amount: number;
};

/** One payment row: Received amount + Cash/GPay for that row. */
export type PaymentRowInput = {
  received: string;
  paymentMode: NotebookPaymentMethod | "";
};

/** @deprecated Use PaymentRowInput */
export type SplitPaymentRowInput = {
  amount: string;
  paymentMode: NotebookPaymentMethod | "";
};

export function sumPaymentRowReceived(
  rows: readonly PaymentRowInput[]
): number {
  return rows.reduce(
    (sum, row) => sum + (Math.round(Number.parseInt(row.received, 10) || 0)),
    0
  );
}

export function parsePaymentRows(
  rows: readonly PaymentRowInput[]
): PaymentAllocation[] | null {
  const parsed: PaymentAllocation[] = [];
  for (const row of rows) {
    const amount = Math.round(Number.parseInt(row.received, 10) || 0);
    if (amount <= 0) continue;
    if (row.paymentMode !== "CASH" && row.paymentMode !== "GPAY") {
      return null;
    }
    parsed.push({ paymentMethod: row.paymentMode, amount });
  }
  return parsed;
}

export function framePaymentRemaining(
  frameAmount: number,
  rows: readonly PaymentRowInput[]
): number {
  return Math.round(frameAmount) - sumPaymentRowReceived(rows);
}

export function resolveEntryPayments(input: {
  frameAmount: number;
  rows: readonly PaymentRowInput[];
}): {
  paidAmount: number;
  paymentMethod?: NotebookPaymentMethod;
  paymentAllocations?: PaymentAllocation[];
  valid: boolean;
  error?: string;
  remaining?: number;
} {
  const frameAmount = Math.round(input.frameAmount);
  const rows = input.rows;
  const totalReceived = sumPaymentRowReceived(rows);

  if (rows.length <= 1) {
    const row = rows[0] ?? { received: "", paymentMode: "" };
    const received = Math.round(Number.parseInt(row.received, 10) || 0);
    if (received <= 0) {
      return { paidAmount: 0, valid: true };
    }
    if (received > frameAmount) {
      return {
        paidAmount: received,
        valid: false,
        error: "Received amount cannot exceed frame amount",
        remaining: frameAmount - received,
      };
    }
    if (row.paymentMode !== "CASH" && row.paymentMode !== "GPAY") {
      return {
        paidAmount: received,
        valid: false,
        error: "Select Cash or GPay",
      };
    }
    return {
      paidAmount: received,
      paymentMethod: row.paymentMode,
      valid: true,
    };
  }

  const remaining = frameAmount - totalReceived;
  if (remaining > 0) {
    return {
      paidAmount: totalReceived,
      valid: false,
      error: `Remaining ${remaining} — payment totals must match frame amount`,
      remaining,
    };
  }
  if (remaining < 0) {
    return {
      paidAmount: totalReceived,
      valid: false,
      error: "Payment totals cannot exceed frame amount",
      remaining,
    };
  }

  const allocations = parsePaymentRows(rows);
  if (!allocations || allocations.length !== rows.length) {
    return {
      paidAmount: totalReceived,
      valid: false,
      error: "Enter received amount and method for each payment row",
      remaining: 0,
    };
  }

  const methods = allocations.map((row) => row.paymentMethod);
  if (new Set(methods).size !== methods.length) {
    return {
      paidAmount: totalReceived,
      valid: false,
      error: "Use Cash and GPay — not the same method twice",
      remaining: 0,
    };
  }

  return {
    paidAmount: totalReceived,
    paymentAllocations: allocations,
    valid: true,
  };
}

/** @deprecated Use resolveEntryPayments with PaymentRowInput */
export function validateSplitPaymentAllocations(input: {
  paidAmount: number;
  rows: readonly SplitPaymentRowInput[];
}): { valid: true; allocations: PaymentAllocation[] } | { valid: false; error: string; remaining: number } {
  const mapped: PaymentRowInput[] = input.rows.map((row) => ({
    received: row.amount,
    paymentMode: row.paymentMode,
  }));
  const resolved = resolveEntryPayments({
    frameAmount: Math.round(input.paidAmount),
    rows: mapped.length > 1 ? mapped : [...mapped, { received: "", paymentMode: "" }],
  });
  if (!resolved.valid) {
    return {
      valid: false,
      error: resolved.error ?? "Invalid payment",
      remaining: resolved.remaining ?? 0,
    };
  }
  if (!resolved.paymentAllocations) {
    return {
      valid: false,
      error: "Enter amount and method for both payments",
      remaining: Math.round(input.paidAmount),
    };
  }
  return { valid: true, allocations: resolved.paymentAllocations };
}

/** @deprecated */
export function splitPaymentRemaining(
  paidAmount: number,
  rows: readonly SplitPaymentRowInput[]
): number {
  return framePaymentRemaining(
    paidAmount,
    rows.map((row) => ({ received: row.amount, paymentMode: row.paymentMode }))
  );
}

/** @deprecated */
export function sumPaymentAllocations(
  allocations: readonly PaymentAllocation[]
): number {
  return allocations.reduce((sum, row) => sum + row.amount, 0);
}

export const defaultPaymentRow = (): PaymentRowInput => ({
  received: "",
  paymentMode: "",
});

export const defaultPaymentRows = (): PaymentRowInput[] => [defaultPaymentRow()];

export function normalizeEntryPaymentMode(
  method: unknown
): NotebookPaymentMethod | "" {
  return method === "CASH" || method === "GPAY" ? method : "";
}

export function paymentRowsFromEntry(entry: {
  amount: number;
  paidAmount?: number;
  paymentMethod?: NotebookPaymentMethod;
  paymentAllocations?: Array<{
    amount: number;
    paymentMethod?: NotebookPaymentMethod;
  }>;
}, defaultReceived: (amount: number, paidAmount?: number | null) => string): PaymentRowInput[] {
  if (entry.paymentAllocations && entry.paymentAllocations.length >= 2) {
    return entry.paymentAllocations.slice(0, 2).map((row) => ({
      received: String(row.amount ?? 0),
      paymentMode: normalizeEntryPaymentMode(row.paymentMethod),
    }));
  }

  return [
    {
      received: defaultReceived(entry.amount, entry.paidAmount),
      paymentMode: normalizeEntryPaymentMode(entry.paymentMethod),
    },
  ];
}
