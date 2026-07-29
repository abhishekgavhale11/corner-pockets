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



export function formatActivityTimeParts(timestamp: string): {

  date: string;

  time: string;

} {

  const d = new Date(timestamp);

  return {

    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),

    time: d.toLocaleTimeString("en-IN", {

      hour: "2-digit",

      minute: "2-digit",

      hour12: false,

    }),

  };

}



export type ActivityEventCategory =

  | "Counter"

  | "Cafe"

  | "Balance"

  | "Paid"

  | "Reversal"

  | "Note";



export function activityEventCategory(

  event: CustomerActivityEventDTO

): ActivityEventCategory {

  switch (event.kind) {

    case "SETTLEMENT":

      return "Paid";

    case "SETTLEMENT_REVERSAL":

      return "Reversal";

    case "CAFE_ENTRY":

      return "Cafe";

    case "COUNTER_ENTRY":

      return "Counter";

    case "BALANCE_RECORDED":

      return "Balance";

    case "NOTE":

      return "Note";

    default:

      return "Counter";

  }

}



export function activityEventCategoryTone(

  category: ActivityEventCategory

): "emerald" | "amber" | "sky" | "violet" | "rose" | "gray" {

  switch (category) {

    case "Counter":

      return "emerald";

    case "Cafe":

      return "amber";

    case "Balance":

      return "amber";

    case "Paid":

      return "sky";

    case "Reversal":

      return "amber";

    default:

      return "gray";

  }

}



export function activityEventDescription(

  event: CustomerActivityEventDTO

): string {

  switch (event.kind) {

    case "SETTLEMENT": {

      const method =

        event.paymentMethod === "CASH" || event.paymentMethod === "GPAY"

          ? paymentMethodLabel(event.paymentMethod)

          : "Cash";

      return method;

    }

    case "SETTLEMENT_REVERSAL":

      return "Payment reversed";

    case "CAFE_ENTRY": {

      const name = event.title.split("—")[1]?.trim() ?? event.title;

      return name.replace(/\s*₹[\d,]+.*$/, "").trim();

    }

    case "COUNTER_ENTRY": {

      if (event.entryType === "RUMMY" && event.playerCount) {

        if (event.title.toLowerCase().includes("cancelled")) {

          return `${getRummyActivityLabel(event.playerCount)} · cancelled`;

        }

        return getRummyActivityLabel(event.playerCount);

      }

      const part = event.title.split("—")[1]?.trim() ?? event.title;

      if (part.toLowerCase().includes("cancelled")) {

        return `${part.replace(/\(Cancelled\)/i, "").trim()} · cancelled`;

      }

      return part.replace(/\s*₹[\d,]+.*$/, "").trim();

    }

    case "NOTE":

      return event.title;

    case "BALANCE_RECORDED":

      return "Due converted to outstanding";

    default:

      return event.title;

  }

}



export function activityEventAmount(

  event: CustomerActivityEventDTO

): number | null {

  if (event.contributionAmount != null) {

    return event.contributionAmount;

  }

  return event.amount ?? null;

}



/** @deprecated Use activityEventDescription + activityEventAmount */

export function activityEventLabel(event: CustomerActivityEventDTO): string {

  const description = activityEventDescription(event);

  const amount = activityEventAmount(event);

  if (amount != null) {

    return `${description} · ₹${amount.toLocaleString("en-IN")}`;

  }

  return description;

}

