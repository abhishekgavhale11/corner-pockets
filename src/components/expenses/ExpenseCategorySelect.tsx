"use client";

import { useEffect, useState, useTransition } from "react";
import { updateExpenseClassificationAction } from "@/actions/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants/expenses";
import { cn } from "@/lib/utils/cn";
import type { ExpenseDTO } from "@/types";

interface ExpenseCategorySelectProps {
  expense: ExpenseDTO;
  canEdit: boolean;
  onSaved: () => void;
}

const selectClassName =
  "h-8 w-full min-w-[8.5rem] max-w-[11rem] rounded-md border border-gray-300 bg-white px-2 text-[12px] font-medium text-gray-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20 disabled:cursor-wait disabled:opacity-60";

export function ExpenseCategorySelect({
  expense,
  canEdit,
  onSaved,
}: ExpenseCategorySelectProps) {
  const [value, setValue] = useState<ExpenseCategory>(expense.category);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(expense.category);
    setError(null);
  }, [expense.id, expense.category]);

  if (!canEdit) {
    return (
      <span className="text-[13px] font-medium text-gray-800">
        {EXPENSE_CATEGORY_LABELS[expense.category]}
      </span>
    );
  }

  const save = (next: ExpenseCategory) => {
    if (isPending || next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("expenseId", expense.id);
      formData.set("category", next);
      const result = await updateExpenseClassificationAction(formData);
      if (!result.success) {
        setValue(previous);
        setError(result.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <div className="min-w-0">
      <select
        aria-label="Category"
        value={value}
        disabled={isPending}
        onChange={(event) => save(event.target.value as ExpenseCategory)}
        className={cn(selectClassName)}
      >
        {EXPENSE_CATEGORIES.map((option) => (
          <option key={option} value={option}>
            {EXPENSE_CATEGORY_LABELS[option]}
          </option>
        ))}
      </select>
      {isPending ? (
        <p className="mt-0.5 text-[10px] font-medium text-gray-400">Saving…</p>
      ) : null}
      {error ? (
        <p className="mt-0.5 text-[11px] font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
