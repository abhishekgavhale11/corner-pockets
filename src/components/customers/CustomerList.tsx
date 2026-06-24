import Link from "next/link";
import {
  getCustomerMembershipLabel,
  hasMembershipCardId,
} from "@/lib/utils/customer-display";
import type { CustomerDTO } from "@/types";
import { cn } from "@/lib/utils/cn";

interface CustomerListProps {
  customers: CustomerDTO[];
}

function membershipClass(label: string): string {
  if (label === "Student") return "text-violet-700";
  if (label === "Member") return "text-emerald-700";
  return "text-gray-500";
}

export function CustomerList({ customers }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <p className="py-4 text-center text-[14px] text-gray-500">No customers found.</p>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-1.5">Name</th>
            <th className="whitespace-nowrap px-2 py-1.5">Type</th>
            <th className="whitespace-nowrap px-2 py-1.5">Card ID</th>
            <th className="whitespace-nowrap px-3 py-1.5">Phone</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {customers.map((customer) => {
            const typeLabel = getCustomerMembershipLabel(customer);
            const cardId = hasMembershipCardId(customer)
              ? customer.cardId
              : "—";
            const phone = customer.phone?.trim() || "—";

            return (
              <tr key={customer.id} className="hover:bg-gray-50">
                <td className="px-3 py-1.5">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="text-[15px] font-bold leading-snug text-gray-900 hover:text-emerald-800"
                  >
                    {customer.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  <Link
                    href={`/customers/${customer.id}`}
                    className={cn(
                      "text-[13px] font-semibold",
                      membershipClass(typeLabel)
                    )}
                  >
                    {typeLabel}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[13px] tabular-nums text-gray-700">
                  <Link href={`/customers/${customer.id}`} className="block">
                    {cardId}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px] tabular-nums text-gray-700">
                  <Link href={`/customers/${customer.id}`} className="block">
                    {phone}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
