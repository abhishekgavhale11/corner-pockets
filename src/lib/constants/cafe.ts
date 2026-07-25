export const CAFE_ITEM_TYPES = [
  "CIGARETTE",
  "WATER",
  "COLD_DRINK",
  "FOOD",
] as const;

export type CafeItemType = (typeof CAFE_ITEM_TYPES)[number];

export const CAFE_ITEM_TYPE_LABELS: Record<CafeItemType, string> = {
  CIGARETTE: "Cigarette",
  WATER: "Water",
  COLD_DRINK: "Cold Drink",
  FOOD: "Food",
};

/** Default unit prices for qty-based items (cashier can change). */
export const CAFE_DEFAULT_UNIT_PRICE: Record<"CIGARETTE" | "WATER", number> = {
  CIGARETTE: 20,
  WATER: 20,
};

export const CAFE_ORDER_STATUSES = ["OPEN", "CANCELLED"] as const;
export type CafeOrderStatus = (typeof CAFE_ORDER_STATUSES)[number];

export const CAFE_PAYMENT_METHODS = ["CASH", "GPAY", "WALLET"] as const;
export type CafePaymentMethod = (typeof CAFE_PAYMENT_METHODS)[number];

export function isQtyCafeItemType(
  type: CafeItemType
): type is "CIGARETTE" | "WATER" {
  return type === "CIGARETTE" || type === "WATER";
}

export function cafeItemLineAmount(item: {
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  amount: number;
}): number {
  if (isQtyCafeItemType(item.type)) {
    return Math.max(0, (item.quantity ?? 0) * (item.unitPrice ?? 0));
  }
  return Math.max(0, item.amount);
}
