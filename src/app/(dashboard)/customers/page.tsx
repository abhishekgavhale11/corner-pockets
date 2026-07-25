import { Suspense } from "react";
import { getCustomers } from "@/actions/customers";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { CustomerFilters } from "@/components/customers/CustomerFilters";
import { CustomerList } from "@/components/customers/CustomerList";
import { NewCustomerButton } from "@/components/customers/NewCustomerDrawer";
import { Pagination } from "@/components/ui/Pagination";

interface CustomersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = await searchParams;
  const result = await getCustomers(params);
  const query = typeof params.q === "string" ? params.q : undefined;
  const filter =
    typeof params.filter === "string" ? params.filter : undefined;
  const autoOpenRegister = params.register === "1";
  const isOutstanding = filter === "outstanding";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">
            Customers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your customers and their outstanding balances
          </p>
        </div>
        <NewCustomerButton autoOpen={autoOpenRegister} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense fallback={<div className="h-10 flex-1 rounded-lg bg-gray-100" />}>
          <CustomerSearch />
        </Suspense>
        <Suspense fallback={<div className="h-10 w-48 rounded-lg bg-gray-100" />}>
          <CustomerFilters
            allCount={result.allCount}
            outstandingCount={result.outstandingCount}
          />
        </Suspense>
      </div>

      <CustomerList
        customers={result.items}
        emptyMessage={
          isOutstanding
            ? "No customers with outstanding balances."
            : "No customers found."
        }
      />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        limit={result.limit}
        query={query}
        filter={filter}
      />
    </div>
  );
}
