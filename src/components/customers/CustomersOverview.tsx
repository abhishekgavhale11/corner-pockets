interface CustomersOverviewProps {
  totalCustomers: number;
}

export function CustomersOverview({ totalCustomers }: CustomersOverviewProps) {
  return (
    <section className="inline-flex items-center gap-6 rounded-[12px] border border-gray-200 bg-white px-4 py-3 shadow-sm shadow-gray-900/5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Total Customers
        </p>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Active customers in CPOS
        </p>
      </div>
      <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight text-gray-900">
        {totalCustomers}
      </p>
    </section>
  );
}
