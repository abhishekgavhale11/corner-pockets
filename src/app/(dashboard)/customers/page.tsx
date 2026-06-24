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
  const autoOpenRegister = params.register === "1";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[16px] font-bold text-gray-900">Customers</h1>
        <NewCustomerButton autoOpen={autoOpenRegister} />
      </div>
      <p className="text-[12px] text-gray-500">{result.total} total</p>

      <Suspense fallback={null}>
        <CustomerFilters />
      </Suspense>

      <Suspense fallback={null}>
        <CustomerSearch />
      </Suspense>

      <CustomerList customers={result.items} />

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        query={query}
      />
    </div>
  );
}
