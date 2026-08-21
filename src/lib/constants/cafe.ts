export const CAFE_ITEM_TYPES = [
  "CIGARETTE",
  "WATER",
  "COLD_DRINK",
  "FOOD",
] as const;

export type CafeItemType = (typeof CAFE_ITEM_TYPES)[number];

/**
 * Display labels for cafe item types.
 * FOOD and COLD_DRINK both present as "Food & Beverages" — stored values unchanged.
 */
export const CAFE_ITEM_TYPE_LABELS: Record<CafeItemType, string> = {
  CIGARETTE: "Cigarette",
  WATER: "Water",
  COLD_DRINK: "Food & Beverages",
  FOOD: "Food & Beverages",
};

/** Categories shown in Add Cafe Item UI (3 buttons). New F&B lines store as FOOD. */
export const CAFE_ADD_ITEM_CATEGORIES: ReadonlyArray<{
  type: CafeItemType;
  label: string;
}> = [
  { type: "CIGARETTE", label: "Cigarette" },
  { type: "WATER", label: "Water" },
  { type: "FOOD", label: "Food & Beverages" },
] as const;

/** Default unit prices for qty-based items (cashier can change). */
export const CAFE_DEFAULT_UNIT_PRICE: Record<"CIGARETTE" | "WATER", number> = {
  CIGARETTE: 30,
  WATER: 10,
};

export const CAFE_ORDER_STATUSES = ["OPEN", "CANCELLED"] as const;
export type CafeOrderStatus = (typeof CAFE_ORDER_STATUSES)[number];

export const CAFE_PAYMENT_METHODS = ["CASH", "GPAY"] as const;
export type CafePaymentMethod = (typeof CAFE_PAYMENT_METHODS)[number];

export function isQtyCafeItemType(
  type: CafeItemType
): type is "CIGARETTE" | "WATER" {
  return type === "CIGARETTE" || type === "WATER";
}

/** Manual description + amount items (Food & Beverages grouping). */
export function isFoodAndBeveragesItemType(
  type: CafeItemType
): type is "FOOD" | "COLD_DRINK" {
  return type === "FOOD" || type === "COLD_DRINK";
}

export function cafeItemTypeDisplayLabel(type: CafeItemType): string {
  return CAFE_ITEM_TYPE_LABELS[type];
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
