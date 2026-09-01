"use client";

import { useEffect, useState, useTransition } from "react";
import { updateExpenseSubcategoryAction } from "@/actions/expenses";
import {
  UNCATEGORIZED_EXPENSE_LABEL,
  expenseSubcategoriesFor,
  expenseSubcategoryLabel,
  resolvedExpenseSubcategory,
  type ExpenseSubcategory,
} from "@/lib/constants/expenses";
import { cn } from "@/lib/utils/cn";
import type { ExpenseDTO } from "@/types";

interface ExpenseSubcategorySelectProps {
  expense: ExpenseDTO;
  canEdit: boolean;
  onSaved: () => void;
}

export function ExpenseSubcategorySelect({
  expense,
  canEdit,
  onSaved,
}: ExpenseSubcategorySelectProps) {
  const resolved = resolvedExpenseSubcategory(
    expense.category,
    expense.subcategory
  );
  const [value, setValue] = useState(resolved ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(
      resolvedExpenseSubcategory(expense.category, expense.subcategory) ?? ""
    );
    setError(null);
  }, [expense.id, expense.category, expense.subcategory]);

  const options = expenseSubcategoriesFor(expense.category);

  if (!canEdit) {
    return (
      <span
        className={cn(
          "text-[13px] font-medium",
          resolved ? "text-gray-800" : "text-gray-400"
        )}
      >
        {resolved ? expenseSubcategoryLabel(resolved) : UNCATEGORIZED_EXPENSE_LABEL}
      </span>
    );
  }

  const save = (next: ExpenseSubcategory) => {
    if (isPending || next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("expenseId", expense.id);
      formData.set("subcategory", next);
      const result = await updateExpenseSubcategoryAction(formData);
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
        aria-label="Subcategory"
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value;
          if (!next || next === value) return;
          save(next as ExpenseSubcategory);
        }}
        className={cn(
          "h-8 w-full min-w-[9.5rem] max-w-[12.5rem] rounded-md border bg-white px-2 text-[12px] font-medium",
          "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/20",
          "disabled:cursor-wait disabled:opacity-60",
          value
            ? "border-gray-300 text-gray-800"
            : "border-amber-300 bg-amber-50/70 text-amber-800"
        )}
      >
        {!value ? (
          <option value="" disabled>
            {UNCATEGORIZED_EXPENSE_LABEL}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {expenseSubcategoryLabel(option)}
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
