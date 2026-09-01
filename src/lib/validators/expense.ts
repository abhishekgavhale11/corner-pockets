import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_SUBCATEGORIES,
  isExpenseSubcategoryOf,
} from "@/lib/constants/expenses";

const amountSchema = z.coerce
  .number()
  .finite("Amount must be a number")
  .int("Amount must be a whole number")
  .min(1, "Amount must be at least ₹1")
  .max(10_000_000, "Amount is too large");

const dateSchema = z
  .string()
  .min(1, "Date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const expenseFieldsSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  subcategory: z.enum(EXPENSE_SUBCATEGORIES),
  amount: amountSchema,
  expenseDate: dateSchema,
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Description is too long")
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, "Description is required"),
  paidTo: z
    .string()
    .max(100, "Paid To is too long")
    .optional()
    .transform((val) => val?.trim() ?? ""),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
});

function refineCategorySubcategory(
  data: { category: (typeof EXPENSE_CATEGORIES)[number]; subcategory: string },
  ctx: z.RefinementCtx
) {
  if (!isExpenseSubcategoryOf(data.category, data.subcategory)) {
    ctx.addIssue({
      code: "custom",
      message: "Select a type that matches the category",
      path: ["subcategory"],
    });
  }
}

export const expenseFormSchema = expenseFieldsSchema.superRefine(
  refineCategorySubcategory
);

export const updateExpenseSchema = expenseFieldsSchema
  .extend({
    expenseId: z.string().min(1, "Expense is required"),
  })
  .superRefine(refineCategorySubcategory);

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense is required"),
});

export const updateExpenseSubcategorySchema = z.object({
  expenseId: z.string().min(1, "Expense is required"),
  subcategory: z.enum(EXPENSE_SUBCATEGORIES),
});

export const updateExpenseClassificationSchema = z
  .object({
    expenseId: z.string().min(1, "Expense is required"),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    subcategory: z.enum(EXPENSE_SUBCATEGORIES).optional(),
  })
  .refine((data) => Boolean(data.category || data.subcategory), {
    message: "Nothing to update",
  });

export const expenseListFilterSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES).optional().default("CAFE"),
    subcategory: z
      .union([z.literal("all"), z.enum(EXPENSE_SUBCATEGORIES)])
      .optional()
      .default("all"),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .transform((data) => {
    if (
      data.subcategory !== "all" &&
      !isExpenseSubcategoryOf(data.category, data.subcategory)
    ) {
      return { ...data, subcategory: "all" as const };
    }
    return data;
  });

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;
export type ExpenseListFilterInput = z.infer<typeof expenseListFilterSchema>;
