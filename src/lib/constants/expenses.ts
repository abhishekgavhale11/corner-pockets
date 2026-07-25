export const EXPENSE_CATEGORIES = ["CAFE", "SNOOKER_OTHER"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  CAFE: "Cafe",
  SNOOKER_OTHER: "Snooker & Other",
};

export const EXPENSE_PAYMENT_METHODS = ["CASH", "GPAY"] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<
  ExpensePaymentMethod,
  string
> = {
  CASH: "Cash",
  GPAY: "GPay",
};

export function expenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[category];
}

export function expensePaymentMethodLabel(
  method: ExpensePaymentMethod
): string {
  return EXPENSE_PAYMENT_METHOD_LABELS[method];
}
