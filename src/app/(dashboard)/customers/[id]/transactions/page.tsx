import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { hasPermission, type StaffRole } from "@/lib/auth/roles";
import { getCustomerById } from "@/actions/customers";
import { getCustomerTransactions } from "@/actions/transactions";
import { CustomerBackLink } from "@/components/customers/CustomerBackLink";
import { TransactionList } from "@/components/transactions/TransactionList";
interface TransactionsPageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionsPage({
  params,
}: TransactionsPageProps) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user?.role ?? "STAFF") as StaffRole;
  const [customer, transactions] = await Promise.all([
    getCustomerById(id),
    getCustomerTransactions(id),
  ]);
  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CustomerBackLink customer={customer} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="mt-1 text-gray-600">
          {customer.name}
          {customer.walletEnabled && customer.cardId
            ? ` (${customer.cardId})`
            : ""}{" "}
          — newest first
        </p>
      </div>
      <TransactionList
        customerId={customer.id}
        transactions={transactions}
        canReverseTransactions={hasPermission(role, "TRANSACTION_REVERSE")}
      />
    </div>
  );
}
