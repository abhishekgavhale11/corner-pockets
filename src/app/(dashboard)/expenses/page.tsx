import { Suspense } from "react";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { listExpensesAction } from "@/actions/expenses";
import { ExpenseFilters } from "@/components/expenses/ExpenseFilters";
import { ExpensesPageClient } from "@/components/expenses/ExpensesPageClient";

interface ExpensesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const [result, session] = await Promise.all([
    listExpensesAction(params),
    auth(),
  ]);
  const role = session?.user?.role as StaffRole | undefined;
  const canCreate = role ? hasPermission(role, "EXPENSE_CREATE") : false;
  const canManage = role ? hasPermission(role, "EXPENSE_MANAGE") : false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">
          Expenses
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Record money spent running the club. Independent of Business Day.
        </p>
      </div>

      <Suspense fallback={<div className="h-16 rounded-lg bg-gray-100" />}>
        <ExpenseFilters
          category={result.category}
          from={result.from}
          to={result.to}
        />
      </Suspense>

      <ExpensesPageClient
        items={result.items}
        totalAmount={result.totalAmount}
        canCreate={canCreate}
        canManage={canManage}
      />
    </div>
  );
}
