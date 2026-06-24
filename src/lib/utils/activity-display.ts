import type { CustomerActivityEventDTO } from "@/types";
import { paymentMethodLabel } from "@/lib/constants/notebook-payments";
import { getRummyActivityLabel } from "@/lib/utils/notebook-entry-label";

export function formatCompactDateTime(date: Date | string): string {
  const d = new Date(date);
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} ${time}`;
}

export function activityEventLabel(event: CustomerActivityEventDTO): string {
  switch (event.kind) {
    case "SETTLEMENT": {
      const method = event.paymentMethod
        ? paymentMethodLabel(event.paymentMethod as "CASH" | "GPAY" | "WALLET")
        : "Cash";
      return `✓ Paid (${method})`;
    }
    case "SETTLEMENT_REVERSAL":
      return "↺ Reversed";
    case "CAFE_ENTRY": {
      const name = event.title.split("—")[1]?.trim() ?? event.title;
      const item = name.replace(/\s*₹[\d,]+.*$/, "").trim();
      return `☕ ${item}`;
    }
    case "COUNTER_ENTRY": {
      if (event.entryType === "RUMMY" && event.playerCount) {
        if (event.title.toLowerCase().includes("cancelled")) {
          return `✖ ${getRummyActivityLabel(event.playerCount)} (Cancelled)`;
        }
        return getRummyActivityLabel(event.playerCount);
      }
      const part = event.title.split("—")[1]?.trim() ?? event.title;
      if (part.toLowerCase().includes("cancelled")) {
        return `✖ ${part.replace(/\(Cancelled\)/i, "").trim()}`;
      }
      const type = part.replace(/\s*₹[\d,]+.*$/, "").trim();
      return `🎱 ${type}`;
    }
    case "WALLET_RECHARGE":
      return "↑ Wallet Recharge";
    case "WALLET_DEDUCT":
      return "↓ Wallet Deduct";
    case "NOTE":
      return "📝 Note";
    default:
      return event.title;
  }
}
