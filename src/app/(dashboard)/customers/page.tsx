import { Suspense } from "react";
import Link from "next/link";
import { getCustomers } from "@/actions/customers";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { CustomerList } from "@/components/customers/CustomerList";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";

interface CustomersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = await searchParams;
  const result = await getCustomers(params);
  const query = typeof params.q === "string" ? params.q : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-gray-600">
            {result.total} customer{result.total !== 1 ? "s" : ""} found
          </p>
        </div>
        <Link href="/customers/new">
          <Button className="w-full sm:w-auto">Register Customer</Button>
        </Link>
      </div>

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
