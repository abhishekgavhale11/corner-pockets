"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@/lib/constants/expenses";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Input";

interface ExpenseFiltersProps {
  category: "all" | ExpenseCategory;
  from: string;
  to: string;
}

export function ExpenseFilters({ category, from, to }: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const replaceParams = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if ((key === "category" && value === "all") || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const qs = params.toString();
    router.replace(qs ? `/expenses?${qs}` : "/expenses");
  };

  const categoryOptions = [
    { id: "all" as const, label: "All" },
    ...EXPENSE_CATEGORIES.map((id) => ({
      id,
      label: EXPENSE_CATEGORY_LABELS[id],
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {categoryOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => replaceParams({ category: option.id })}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-bold",
              category === option.id
                ? "bg-emerald-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
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
    </div>
  );
}
