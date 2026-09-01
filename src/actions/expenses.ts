"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import Expense from "@/models/Expense";
import {
  isExpenseSubcategoryOf,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/constants/expenses";
import {
  expenseDateRangeMongoBounds,
  resolveExpenseDateRange,
} from "@/lib/expenses/date-range";
import { getBusinessDate, parseBusinessDateInput } from "@/lib/utils/business-date";
import { failure, success, type ActionResult } from "@/lib/utils/action-result";
import {
  deleteExpenseSchema,
  expenseFormSchema,
  expenseListFilterSchema,
  updateExpenseSchema,
  updateExpenseClassificationSchema,
} from "@/lib/validators/expense";
import type { ExpenseDTO, ExpenseListResult } from "@/types";
import type { IExpense } from "@/models/Expense";

function toExpenseDTO(doc: IExpense | Record<string, unknown>): ExpenseDTO {
  const expense = doc as IExpense;
  return {
    id: String(expense._id),
    category: expense.category,
    subcategory: expense.subcategory,
    amount: expense.amount,
    expenseDate: getBusinessDate(expense.expenseDate),
    description: expense.description,
    paidTo: expense.paidTo ?? "",
    paymentMethod: expense.paymentMethod,
    createdBy: expense.createdBy,
    updatedBy: expense.updatedBy,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

function revalidateExpenses() {
  revalidatePath("/expenses");
}

export async function listExpensesAction(
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<ExpenseListResult> {
  const authResult = await authorizePermission("EXPENSE_VIEW");
  if (!("session" in authResult)) {
    const range = resolveExpenseDateRange();
    return {
      items: [],
      totalAmount: 0,
      from: range.from,
      to: range.to,
      category: "CAFE",
      subcategory: "all",
    };
  }

  await connectDB();

  const rawCategory =
    typeof searchParams.category === "string"
      ? searchParams.category
      : undefined;

  const parsed = expenseListFilterSchema.safeParse({
    category:
      rawCategory === "CAFE" || rawCategory === "SNOOKER_OTHER"
        ? rawCategory
        : undefined,
    subcategory:
      typeof searchParams.subcategory === "string"
        ? searchParams.subcategory
        : undefined,
    from: typeof searchParams.from === "string" ? searchParams.from : undefined,
    to: typeof searchParams.to === "string" ? searchParams.to : undefined,
  });

  const filters = parsed.success
    ? parsed.data
    : {
        category: "CAFE" as const,
        subcategory: "all" as const,
        from: undefined,
        to: undefined,
      };

  const { from, to } = resolveExpenseDateRange(filters.from, filters.to);
  const { start, end } = expenseDateRangeMongoBounds(from, to);

  const query: Record<string, unknown> = {
    expenseDate: { $gte: start, $lte: end },
    category: filters.category,
  };

  if (filters.subcategory !== "all") {
    query.subcategory = filters.subcategory;
  }

  const [items, totalAgg] = await Promise.all([
    Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean(),
    Expense.aggregate<{ total: number }>([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    items: items.map((item) => toExpenseDTO(item)),
    totalAmount: totalAgg[0]?.total ?? 0,
    from,
    to,
    category: filters.category,
    subcategory: filters.subcategory,
  };
}

export async function createExpenseAction(
  formData: FormData
): Promise<ActionResult<ExpenseDTO>> {
  const authResult = await authorizePermission("EXPENSE_CREATE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = expenseFormSchema.safeParse({
    category: formData.get("category"),
    subcategory: formData.get("subcategory"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    description: formData.get("description"),
    paidTo: formData.get("paidTo") ?? "",
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await connectDB();

  try {
    const expense = await Expense.create({
      category: parsed.data.category,
      subcategory: parsed.data.subcategory,
      amount: parsed.data.amount,
      expenseDate: parseBusinessDateInput(parsed.data.expenseDate),
      description: parsed.data.description,
      paidTo: parsed.data.paidTo,
      paymentMethod: parsed.data.paymentMethod,
      createdBy: authResult.session.user.username,
    });

    revalidateExpenses();
    return success(toExpenseDTO(expense));
  } catch (error) {
    console.error("createExpenseAction failed:", error);
    return failure("Could not save expense");
  }
}

export async function updateExpenseAction(
  formData: FormData
): Promise<ActionResult<ExpenseDTO>> {
  const authResult = await authorizePermission("EXPENSE_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    category: formData.get("category"),
    subcategory: formData.get("subcategory"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    description: formData.get("description"),
    paidTo: formData.get("paidTo") ?? "",
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.expenseId)) {
    return failure("Expense not found");
  }

  await connectDB();

  const expense = await Expense.findById(parsed.data.expenseId);
  if (!expense) {
    return failure("Expense not found");
  }

  expense.category = parsed.data.category;
  expense.subcategory = parsed.data.subcategory;
  expense.amount = parsed.data.amount;
  expense.expenseDate = parseBusinessDateInput(parsed.data.expenseDate);
  expense.description = parsed.data.description;
  expense.paidTo = parsed.data.paidTo;
  expense.paymentMethod = parsed.data.paymentMethod;
  expense.updatedBy = authResult.session.user.username;

  try {
    await expense.save();
    revalidateExpenses();
    return success(toExpenseDTO(expense));
  } catch (error) {
    console.error("updateExpenseAction failed:", error);
    return failure("Could not update expense");
  }
}

export async function deleteExpenseAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const authResult = await authorizePermission("EXPENSE_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const parsed = deleteExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.expenseId)) {
    return failure("Expense not found");
  }

  await connectDB();

  const deleted = await Expense.findByIdAndDelete(parsed.data.expenseId);
  if (!deleted) {
    return failure("Expense not found");
  }

  revalidateExpenses();
  return success({ id: parsed.data.expenseId });
}

export async function updateExpenseClassificationAction(
  formData: FormData
): Promise<ActionResult<ExpenseDTO>> {
  const authResult = await authorizePermission("EXPENSE_MANAGE");
  if (!("session" in authResult)) {
    return authResult;
  }

  const rawSubcategory = formData.get("subcategory");
  const parsed = updateExpenseClassificationSchema.safeParse({
    expenseId: formData.get("expenseId"),
    category: formData.get("category") || undefined,
    subcategory:
      typeof rawSubcategory === "string" && rawSubcategory
        ? rawSubcategory
        : undefined,
  });

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (!mongoose.Types.ObjectId.isValid(parsed.data.expenseId)) {
    return failure("Expense not found");
  }

  await connectDB();

  const expense = await Expense.findById(parsed.data.expenseId).lean();
  if (!expense) {
    return failure("Expense not found");
  }

  const nextCategory: ExpenseCategory =
    parsed.data.category ?? expense.category;
  const currentSubcategory = expense.subcategory as
    | ExpenseSubcategory
    | undefined;
  const nextSubcategory = parsed.data.subcategory;

  if (
    nextSubcategory &&
    !isExpenseSubcategoryOf(nextCategory, nextSubcategory)
  ) {
    return failure("Select a subcategory that matches this expense category");
  }

  const $set: Record<string, unknown> = {
    updatedBy: authResult.session.user.username,
    updatedAt: new Date(),
  };
  const $unset: Record<string, unknown> = {};

  if (parsed.data.category && parsed.data.category !== expense.category) {
    $set.category = parsed.data.category;
  }

  if (nextSubcategory) {
    $set.subcategory = nextSubcategory;
  } else if (
    parsed.data.category &&
    parsed.data.category !== expense.category &&
    !isExpenseSubcategoryOf(nextCategory, currentSubcategory ?? "")
  ) {
    $unset.subcategory = "";
  }

  if (!("category" in $set) && !("subcategory" in $set) && !("subcategory" in $unset)) {
    return success(toExpenseDTO(expense));
  }

  try {
    const id = new mongoose.Types.ObjectId(parsed.data.expenseId);
    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) {
      update.$unset = $unset;
    }
    const write = await Expense.collection.updateOne({ _id: id }, update);
    if (write.matchedCount === 0) {
      return failure("Expense not found");
    }
    const updated = await Expense.findById(id).lean();
    if (!updated) {
      return failure("Expense not found");
    }
    revalidateExpenses();
    return success(toExpenseDTO(updated));
  } catch (error) {
    console.error("updateExpenseClassificationAction failed:", error);
    return failure("Could not update classification");
  }
}

export async function updateExpenseSubcategoryAction(
  formData: FormData
): Promise<ActionResult<ExpenseDTO>> {
  return updateExpenseClassificationAction(formData);
}
