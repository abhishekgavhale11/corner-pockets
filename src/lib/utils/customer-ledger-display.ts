import { formatCurrency } from "@/lib/utils/format";
import type { CustomerLedgerEventKind } from "@/types";

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

export function formatLedgerAmountForKind(
  kind: CustomerLedgerEventKind,
  amount: number
): string {
  if (kind === "status") {
    if (amount === 0) return "—";
    return formatCurrency(Math.abs(amount));
  }
  return formatLedgerAmount(amount);
}

export function ledgerEventKindLabel(kind: CustomerLedgerEventKind): string {
  switch (kind) {
    case "charge":
      return "Charge";
    case "payment":
      return "Payment";
    case "status":
      return "Status";
  }
}

export function ledgerLineAmountClass(
  kind: CustomerLedgerEventKind,
  amount: number
): string {
  if (kind === "charge") return "text-red-700";
  if (kind === "payment") return "text-emerald-700";
  return "text-amber-700";
}

export function ledgerLineRowClass(kind: CustomerLedgerEventKind): string {
  switch (kind) {
    case "charge":
      return "border-l-[3px] border-l-red-400";
    case "payment":
      return "border-l-[3px] border-l-emerald-400";
    case "status":
      return "border-l-[3px] border-l-amber-400 bg-amber-50/40";
  }
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
