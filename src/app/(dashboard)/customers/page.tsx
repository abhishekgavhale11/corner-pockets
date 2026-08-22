import { Suspense } from "react";
import { getCustomers } from "@/actions/customers";
import { CustomerSearch } from "@/components/customers/CustomerSearch";
import { CustomerFilters } from "@/components/customers/CustomerFilters";
import { CustomerList } from "@/components/customers/CustomerList";
import { CustomersOverview } from "@/components/customers/CustomersOverview";
import { NewCustomerButton } from "@/components/customers/NewCustomerDrawer";
import {
  HistoryEmptyState,
  HistoryPageLayout,
} from "@/components/business-day/history";
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
  const showList =
    Boolean(query?.trim()) ||
    filter === "all" ||
    filter === "outstanding" ||
    (result.page > 1 && result.items.length > 0);

  return (
    <HistoryPageLayout
      title="Customers"
      subtitle="Manage your customers and their outstanding balances"
      actions={<NewCustomerButton autoOpen={autoOpenRegister} />}
      filters={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Suspense
            fallback={
              <div className="h-[42px] flex-1 rounded-[11px] bg-gray-100" />
            }
          >
            <CustomerSearch />
          </Suspense>
          <Suspense
            fallback={
              <div className="h-[42px] w-52 rounded-[11px] bg-gray-100" />
            }
          >
            <CustomerFilters
              allCount={result.allCount}
              outstandingCount={result.outstandingCount}
            />
          </Suspense>
        </div>
      }
    >
      <CustomersOverview totalCustomers={result.allCount} />

      {showList ? (
        <>
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
        </>
      ) : (
        <HistoryEmptyState message="Search for a customer to view details" />
      )}
    </HistoryPageLayout>
  );
}
