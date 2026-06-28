import { formatCurrency } from "@/lib/utils/format";

export function formatLedgerBalanceLabel(
  walletBalance: number,
  outstandingBalance: number
): string {
  if (outstandingBalance > 0) {
    return `Outstanding ${formatCurrency(outstandingBalance)}`;
  }

  if (walletBalance > 0) {
    return `Wallet ${formatCurrency(walletBalance)}`;
  }

  return "₹0";
}

export function formatLastPaymentLabel(
  amount: number | null,
  timestamp: string | null
): string {
  if (!amount || !timestamp) {
    return "—";
  }
  return `${formatCurrency(amount)} (${formatLastVisitLabel(timestamp)})`;
}

export function formatLedgerAmount(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  const prefix = amount > 0 ? "+" : "−";
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}

export function formatLastVisitLabel(timestamp: string | null): string {
  if (!timestamp) return "—";

  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfVisit = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfVisit.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
