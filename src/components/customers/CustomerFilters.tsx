"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const filters = [
  { id: "all", label: "All Customers" },
  { id: "members", label: "Members" },
  { id: "students", label: "Students" },
  { id: "wallet", label: "Wallet Enabled" },
  { id: "regular", label: "Regular" },
] as const;

export function CustomerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("filter") ?? "all";

  const setFilter = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    params.delete("page");
    router.replace(`/customers?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => setFilter(filter.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] font-bold",
            active === filter.id
              ? "bg-emerald-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
