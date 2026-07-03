import { formatCurrency } from "@/lib/utils/format";
import type { NotebookPaymentMethod } from "@/lib/constants/notebook-payments";
import type {
  CustomerLedgerEventKind,
  CustomerLedgerPaymentContext,
} from "@/types";

export function formatLedgerPaymentContextLabel(
  context: CustomerLedgerPaymentContext
): string {
  switch (context) {
    case "ACTIVE_VISIT":
      return "Visit";
    case "OUTSTANDING":
      return "Outstanding";
    case "WALLET":
      return "Wallet";
    case "REFUND":
      return "Refund";
  }
}

export function formatPaymentReceivedDescription(
  method: NotebookPaymentMethod,
  context: CustomerLedgerPaymentContext
): string {
  const contextLabel = formatLedgerPaymentContextLabel(context);
  switch (method) {
    case "CASH":
      return `Cash Received (${contextLabel})`;
    case "GPAY":
      return `GPay Received (${contextLabel})`;
    case "WALLET":
      return `Wallet Payment (${contextLabel})`;
  }
}

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
      return "border-l-[3px] border-l-amber-400 bg-amber-50/75 ring-1 ring-inset ring-amber-100/90";
  }
}

export function ledgerLineDescriptionClass(kind: CustomerLedgerEventKind): string {
  if (kind === "status") {
    return "font-semibold text-amber-950";
  }
  return "font-medium text-gray-800";
}

export function ledgerOutstandingClass(outstandingBalance: number): string {
  if (outstandingBalance === 0) {
    return "text-emerald-700";
  }
  return "text-gray-900";
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
