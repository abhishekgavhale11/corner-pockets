"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { authorizePermission } from "@/lib/auth/session";
import Expense from "@/models/Expense";
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
} from "@/lib/validators/expense";
import type { ExpenseDTO, ExpenseListResult } from "@/types";
import type { IExpense } from "@/models/Expense";

function toExpenseDTO(doc: IExpense | Record<string, unknown>): ExpenseDTO {
  const expense = doc as IExpense;
  return {
    id: String(expense._id),
    category: expense.category,
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
      category: "all",
    };
  }

  await connectDB();

  const parsed = expenseListFilterSchema.safeParse({
    category:
      typeof searchParams.category === "string"
        ? searchParams.category
        : undefined,
    from: typeof searchParams.from === "string" ? searchParams.from : undefined,
    to: typeof searchParams.to === "string" ? searchParams.to : undefined,
  });

  const filters = parsed.success
    ? parsed.data
    : {
        category: "all" as const,
        from: undefined,
        to: undefined,
      };

  const { from, to } = resolveExpenseDateRange(filters.from, filters.to);
  const { start, end } = expenseDateRangeMongoBounds(from, to);

  const query: Record<string, unknown> = {
    expenseDate: { $gte: start, $lte: end },
  };

  if (filters.category !== "all") {
    query.category = filters.category;
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
