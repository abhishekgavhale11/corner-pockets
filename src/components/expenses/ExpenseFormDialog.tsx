"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/actions/expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from "@/lib/constants/expenses";
import { getBusinessDate } from "@/lib/utils/business-date";
import type { ExpenseDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  expense?: ExpenseDTO | null;
  onSaved: () => void;
}

export function ExpenseFormDialog({
  open,
  onClose,
  expense,
  onSaved,
}: ExpenseFormDialogProps) {
  const isEdit = Boolean(expense);
  const [category, setCategory] = useState<ExpenseCategory>("CAFE");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(getBusinessDate());
  const [description, setDescription] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setCategory(expense.category);
      setAmount(String(expense.amount));
      setExpenseDate(expense.expenseDate);
      setDescription(expense.description);
      setPaidTo(expense.paidTo);
      setPaymentMethod(expense.paymentMethod);
    } else {
      setCategory("CAFE");
      setAmount("");
      setExpenseDate(getBusinessDate());
      setDescription("");
      setPaidTo("");
      setPaymentMethod("CASH");
    }
    setError(null);
  }, [open, expense]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("category", category);
      formData.set("amount", amount);
      formData.set("expenseDate", expenseDate);
      formData.set("description", description);
      formData.set("paidTo", paidTo);
      formData.set("paymentMethod", paymentMethod);
      if (expense) {
        formData.set("expenseId", expense.id);
      }

      const result = expense
        ? await updateExpenseAction(formData)
        : await createExpenseAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => !isPending && onClose()}
      title={isEdit ? "Edit Expense" : "Add Expense"}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="expense-category">Category *</Label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            required
            className="mt-0.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            {EXPENSE_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {EXPENSE_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="expense-amount">Amount *</Label>
          <Input
            id="expense-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0"
            className="h-10"
          />
        </div>

        <div>
          <Label htmlFor="expense-date">Date *</Label>
          <Input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="h-10"
          />
        </div>

        <div>
          <Label htmlFor="expense-description">Description *</Label>
          <Input
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="e.g. Electricity Bill, Milk Purchase"
            className="h-10"
          />
        </div>

        <div>
          <Label htmlFor="expense-paid-to">Paid To</Label>
          <Input
            id="expense-paid-to"
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            placeholder="e.g. D-Mart, Mahesh, MSEDCL"
            className="h-10"
          />
        </div>

        <div>
          <Label htmlFor="expense-payment-method">Payment Method *</Label>
          <select
            id="expense-payment-method"
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as ExpensePaymentMethod)
            }
            required
            className="mt-0.5 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            {EXPENSE_PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {EXPENSE_PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Save Expense"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
