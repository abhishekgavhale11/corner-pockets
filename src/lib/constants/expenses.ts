export const EXPENSE_CATEGORIES = ["CAFE", "SNOOKER_OTHER"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  CAFE: "Cafe",
  SNOOKER_OTHER: "Snooker & Other",
};

export const CAFE_EXPENSE_SUBCATEGORIES = [
  "FOOD_INGREDIENTS",
  "CIGARETTES",
  "WATER_COLD_DRINKS",
] as const;

export const SNOOKER_EXPENSE_SUBCATEGORIES = [
  "SALARIES",
  "ELECTRICITY",
  "RENT",
  "OTHER",
] as const;

export const EXPENSE_SUBCATEGORIES = [
  ...CAFE_EXPENSE_SUBCATEGORIES,
  ...SNOOKER_EXPENSE_SUBCATEGORIES,
] as const;

export type ExpenseSubcategory = (typeof EXPENSE_SUBCATEGORIES)[number];

export const EXPENSE_SUBCATEGORY_LABELS: Record<ExpenseSubcategory, string> = {
  FOOD_INGREDIENTS: "Food & Ingredients",
  CIGARETTES: "Cigarettes",
  WATER_COLD_DRINKS: "Water & Cold Drinks",
  SALARIES: "Salary",
  ELECTRICITY: "Light Bill",
  RENT: "Rent",
  OTHER: "Miscellaneous",
};

export const UNCATEGORIZED_EXPENSE_LABEL = "Uncategorized";

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

export function expenseSubcategoryLabel(
  subcategory: ExpenseSubcategory
): string {
  return EXPENSE_SUBCATEGORY_LABELS[subcategory];
}

export function expenseSubcategoriesFor(
  category: ExpenseCategory
): readonly ExpenseSubcategory[] {
  return category === "CAFE"
    ? CAFE_EXPENSE_SUBCATEGORIES
    : SNOOKER_EXPENSE_SUBCATEGORIES;
}

export function isExpenseSubcategoryOf(
  category: ExpenseCategory,
  subcategory: string
): subcategory is ExpenseSubcategory {
  return (expenseSubcategoriesFor(category) as readonly string[]).includes(
    subcategory
  );
}

export function resolvedExpenseSubcategory(
  category: ExpenseCategory,
  subcategory?: ExpenseSubcategory | null
): ExpenseSubcategory | null {
  if (subcategory && isExpenseSubcategoryOf(category, subcategory)) {
    return subcategory;
  }
  return null;
}

export function defaultExpenseSubcategory(
  category: ExpenseCategory
): ExpenseSubcategory {
  return category === "CAFE" ? "FOOD_INGREDIENTS" : "SALARIES";
}

export function expensePaymentMethodLabel(
  method: ExpensePaymentMethod
): string {
  return EXPENSE_PAYMENT_METHOD_LABELS[method];
}
