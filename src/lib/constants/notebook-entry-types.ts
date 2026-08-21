export const NOTEBOOK_ENTRY_TYPES = [
  "SNOOKER",
  "RUMMY",
  "MINI",
  "POOL",
  "CIGARETTE",
  "SANDWICH",
  "TEA",
  "COFFEE",
  "WATER",
  "COLD_DRINK",
  "TEA_COFFEE",
  "FOOD",
  "OTHER",
] as const;

export type NotebookEntryType = (typeof NOTEBOOK_ENTRY_TYPES)[number];

export const NOTEBOOK_ENTRY_TYPE_LABELS: Record<NotebookEntryType, string> = {
  SNOOKER: "Snooker",
  RUMMY: "Rummy",
  MINI: "Mini Snooker",
  POOL: "Pool",
  CIGARETTE: "Cigarette",
  SANDWICH: "Sandwich",
  TEA: "Tea",
  COFFEE: "Coffee",
  WATER: "Water",
  COLD_DRINK: "Food & Beverages",
  TEA_COFFEE: "Tea / Coffee",
  FOOD: "Food & Beverages",
  OTHER: "Other",
};

export function entryTypeLabel(type: NotebookEntryType): string {
  return NOTEBOOK_ENTRY_TYPE_LABELS[type];
}
