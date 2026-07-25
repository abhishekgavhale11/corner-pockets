import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
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

export const expenseFormSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
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

export const updateExpenseSchema = expenseFormSchema.extend({
  expenseId: z.string().min(1, "Expense is required"),
});

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1, "Expense is required"),
});

export const expenseListFilterSchema = z.object({
  category: z
    .union([z.literal("all"), z.enum(EXPENSE_CATEGORIES)])
    .optional()
    .default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;
export type ExpenseListFilterInput = z.infer<typeof expenseListFilterSchema>;
