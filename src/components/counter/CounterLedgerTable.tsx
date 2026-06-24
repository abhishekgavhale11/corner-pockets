interface CounterLedgerTableProps {
  children: React.ReactNode;
  className?: string;
}

export function CounterLedgerTable({
  children,
  className = "max-h-[calc(100vh-160px)] flex-1 overflow-y-auto",
}: CounterLedgerTableProps) {
  return (
    <div className={className}>
      <table className="w-full table-fixed border-collapse">
        <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100">
          <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            <th className="w-[3.25rem] px-2 py-2 text-left font-semibold">
              Time
            </th>
            <th className="w-[30%] px-2 py-2 text-left font-semibold">Type</th>
            <th className="w-[4.75rem] px-2 py-2 text-left font-semibold">
              Amount
            </th>
            <th className="px-2 py-2 text-right font-semibold">Name</th>
            <th className="w-[5.75rem] px-2 py-2 text-right font-semibold">
              Payment Type
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
