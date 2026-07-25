"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpenseAction } from "@/actions/expenses";
import {
  expenseCategoryLabel,
  expensePaymentMethodLabel,
} from "@/lib/constants/expenses";
import { formatBusinessDayDate } from "@/lib/business-day/format";
import { formatCurrency } from "@/lib/utils/format";
import type { ExpenseDTO } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";

interface ExpensesPageClientProps {
  items: ExpenseDTO[];
  totalAmount: number;
  canCreate: boolean;
  canManage: boolean;
}

export function ExpensesPageClient({
  items,
  totalAmount,
  canCreate,
  canManage,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDTO | null>(null);
  const [deleting, setDeleting] = useState<ExpenseDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = () => router.refresh();

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("expenseId", deleting.id);
      const result = await deleteExpenseAction(formData);
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }
      setDeleting(null);
      refresh();
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Total Expenses
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-950">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        {canCreate ? (
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="h-10 px-4 text-sm font-semibold"
          >
            + Add Expense
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No expenses for this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Paid To</th>
                  <th className="px-3 py-2">Payment Method</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  {canManage ? (
                    <th className="px-3 py-2 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-gray-700">
                      {formatBusinessDayDate(expense.expenseDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] font-medium text-gray-800">
                      {expenseCategoryLabel(expense.category)}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-1.5 text-[13px] text-gray-900">
                      {expense.description}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-gray-600">
                      {expense.paidTo || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-gray-700">
                      {expensePaymentMethodLabel(expense.paymentMethod)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-[13px] font-bold tabular-nums text-gray-950">
                      {formatCurrency(expense.amount)}
                    </td>
                    {canManage ? (
                      <td className="whitespace-nowrap px-3 py-1.5 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(expense);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleting(expense);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canCreate || canManage ? (
        <ExpenseFormDialog
          open={formOpen}
          expense={canManage ? editing : null}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      ) : null}

      {canManage ? (
        <ConfirmDialog
          open={Boolean(deleting)}
          onClose={() => !isPending && setDeleting(null)}
          onConfirm={confirmDelete}
          title="Delete Expense"
          message={
            deleting
              ? `Delete “${deleting.description}” for ${formatCurrency(deleting.amount)}? This cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          isLoading={isPending}
        />
      ) : null}

      {deleteError ? (
        <p className="mt-3 text-sm text-red-700">{deleteError}</p>
      ) : null}
    </>
  );
}
