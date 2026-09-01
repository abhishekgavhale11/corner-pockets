"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseSubcategoriesFor,
  expenseSubcategoryLabel,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/constants/expenses";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";

interface ExpenseFiltersProps {
  category: ExpenseCategory;
  subcategory: "all" | ExpenseSubcategory;
  from: string;
  to: string;
}

export function ExpenseFilters({
  category,
  subcategory,
  from,
  to,
}: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const replaceParams = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (
        (key === "category" && value === "CAFE") ||
        (key === "subcategory" && value === "all") ||
        value === ""
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const qs = params.toString();
    router.replace(qs ? `/expenses?${qs}` : "/expenses");
  };

  const subOptions = [
    { id: "all" as const, label: "All" },
    ...expenseSubcategoriesFor(category).map((id) => ({
      id,
      label: expenseSubcategoryLabel(id),
    })),
  ];

  return (
    <section className="space-y-4 rounded-[12px] border border-gray-200 bg-white p-4 shadow-sm shadow-gray-900/5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Group
        </p>
        <div
          className="inline-flex w-full gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 sm:w-auto"
          role="tablist"
          aria-label="Expense group"
        >
          {EXPENSE_CATEGORIES.map((id) => {
            const selected = category === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() =>
                  replaceParams({ category: id, subcategory: "all" })
                }
                className={cn(
                  "flex-1 rounded-md px-4 py-2 text-[13px] font-semibold transition sm:flex-none",
                  selected
                    ? "bg-emerald-800 text-white shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                )}
              >
                {EXPENSE_CATEGORY_LABELS[id]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Subcategory
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={`${EXPENSE_CATEGORY_LABELS[category]} expense type`}
        >
          {subOptions.map((option) => {
            const selected = subcategory === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => replaceParams({ subcategory: option.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  selected
                    ? "border-emerald-800 bg-emerald-800 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 border-t border-gray-100 pt-4 sm:max-w-md sm:grid-cols-2">
        <div>
          <label
            htmlFor="expense-from"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            From
          </label>
          <Input
            id="expense-from"
            type="date"
            value={from}
            onChange={(e) =>
              replaceParams({
                from: e.target.value,
                to,
              })
            }
            className="h-9"
          />
        </div>
        <div>
          <label
            htmlFor="expense-to"
            className="mb-1 block text-xs font-medium text-gray-500"
          >
            To
          </label>
          <Input
            id="expense-to"
            type="date"
            value={to}
            onChange={(e) =>
              replaceParams({
                from,
                to: e.target.value,
              })
            }
            className="h-9"
          />
        </div>
      </div>
    </section>
  );
}
