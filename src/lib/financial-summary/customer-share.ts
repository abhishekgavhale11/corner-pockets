import { frameReceivedAmount } from "@/lib/utils/frame-payment";

function sameCustomerId(
  left: string | undefined | null,
  right: string
): boolean {
  return Boolean(left) && String(left) === String(right);
}

/**
 * Customer share of Bill and Received on a notebook entry.
 * Split frames use the contributor row; never the parent total.
 * Shared by Customer Timeline and Lifetime Paid.
 */
export function customerEntryShare(
  entry: {
    customerId?: string | null;
    amount: number;
    paidAmount?: number | null;
    balanceCollectedAmount?: number | null;
    contributors?: Array<{
      customerId?: string | null;
      amount: number;
      paidAmount?: number | null;
      balanceCollectedAmount?: number | null;
    }> | null;
  },
  customerId: string
): { amount: number; paidAmount: number } | null {
  if (entry.contributors && entry.contributors.length > 0) {
    const contributor = entry.contributors.find((row) =>
      sameCustomerId(row.customerId, customerId)
    );
    if (!contributor) return null;
    return {
      amount: contributor.amount,
      paidAmount: frameReceivedAmount(
        contributor.paidAmount,
        contributor.balanceCollectedAmount
      ),
    };
  }

  if (!sameCustomerId(entry.customerId, customerId)) return null;

  return {
    amount: entry.amount,
    paidAmount: frameReceivedAmount(
      entry.paidAmount,
      entry.balanceCollectedAmount
    ),
  };
}

/**
 * Customer Received only (Lifetime Paid grain).
 */
export function customerEntryReceived(
  entry: {
    customerId?: { toString(): string } | string | null;
    paidAmount?: number | null;
    balanceCollectedAmount?: number | null;
    contributors?: Array<{
      customerId?: { toString(): string } | string | null;
      paidAmount?: number | null;
      balanceCollectedAmount?: number | null;
    }> | null;
  },
  customerId: string
): number {
  if (entry.contributors && entry.contributors.length > 0) {
    const contributor = entry.contributors.find(
      (row) => row.customerId && String(row.customerId) === customerId
    );
    if (!contributor) return 0;
    return frameReceivedAmount(
      contributor.paidAmount,
      contributor.balanceCollectedAmount
    );
  }

  if (!entry.customerId || String(entry.customerId) !== customerId) return 0;
  return frameReceivedAmount(entry.paidAmount, entry.balanceCollectedAmount);
}
