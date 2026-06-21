import Link from "next/link";
import type { CustomerDTO } from "@/types";

interface CustomerBackLinkProps {
  customer: CustomerDTO;
}

export function CustomerBackLink({ customer }: CustomerBackLinkProps) {
  return (
    <div>
      <Link
        href={`/customers/${customer.id}`}
        className="text-sm font-medium text-emerald-800 hover:underline"
      >
        ← Back to {customer.name}
      </Link>
    </div>
  );
}
